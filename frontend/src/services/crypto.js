/**
 * E2EE layer — ECDH P-256 key exchange + AES-256-GCM encryption.
 *
 * 1-1 messages:
 *   encrypt: ECDH(myPriv, theirPub) → shared AES key → AES-GCM(plaintext)
 *   decrypt: same derivation, same key — both parties can decrypt
 *
 * Group messages:
 *   encrypt: random AES msgKey → AES-GCM(plaintext);
 *            for each recipient → ECDH-derived key wraps msgKey;
 *            for sender's own copy → selfKey wraps msgKey (stored as "self.iv.ct")
 *   decrypt: unwrap msgKey (via ECDH or selfKey), then AES-GCM decrypt
 */

const EC_ALGO = { name: 'ECDH', namedCurve: 'P-256' }
const AES_ALGO = { name: 'AES-GCM', length: 256 }
const enc = new TextEncoder()
const dec = new TextDecoder()

function b64enc(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}
function b64dec(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

export async function generateKeyPair() {
  const kp = await crypto.subtle.generateKey(EC_ALGO, true, ['deriveKey'])
  const publicJwk = await crypto.subtle.exportKey('jwk', kp.publicKey)
  const privateJwk = await crypto.subtle.exportKey('jwk', kp.privateKey)
  return { publicJwk, privateJwk }
}

export async function generateSelfKey() {
  const key = await crypto.subtle.generateKey(AES_ALGO, true, ['encrypt', 'decrypt'])
  const raw = await crypto.subtle.exportKey('raw', key)
  return b64enc(raw)
}

// ---------------------------------------------------------------------------
// Internal key import helpers
// ---------------------------------------------------------------------------

function importPublicKey(jwk) {
  return crypto.subtle.importKey('jwk', jwk, EC_ALGO, true, [])
}

function importPrivateKey(jwk) {
  return crypto.subtle.importKey('jwk', jwk, EC_ALGO, true, ['deriveKey'])
}

async function deriveSharedKey(myPrivJwk, theirPubJwk) {
  const myPriv = await importPrivateKey(myPrivJwk)
  const theirPub = await importPublicKey(theirPubJwk)
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPub },
    myPriv,
    AES_ALGO, false, ['encrypt', 'decrypt'],
  )
}

async function importSelfKey(selfKeyB64) {
  return crypto.subtle.importKey('raw', b64dec(selfKeyB64), AES_ALGO, false, ['encrypt', 'decrypt'])
}

// ---------------------------------------------------------------------------
// 1-1 encryption / decryption
// ---------------------------------------------------------------------------

export async function encryptDirect(plaintext, myPrivJwk, theirPubJwk) {
  const sharedKey = await deriveSharedKey(myPrivJwk, theirPubJwk)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sharedKey, enc.encode(plaintext))
  return b64enc(iv) + '.' + b64enc(ct)
}

export async function decryptDirect(encrypted, myPrivJwk, theirPubJwk) {
  const [ivB64, ctB64] = encrypted.split('.')
  const sharedKey = await deriveSharedKey(myPrivJwk, theirPubJwk)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64dec(ivB64) },
    sharedKey, b64dec(ctB64),
  )
  return dec.decode(plain)
}

// ---------------------------------------------------------------------------
// Group encryption / decryption
// ---------------------------------------------------------------------------

/**
 * Encrypts a group message.
 * @param {string} plaintext
 * @param {string} senderId - sender's peer_id
 * @param {object} myPrivJwk - sender's ECDH private key JWK
 * @param {string} selfKeyB64 - sender's self-seal AES key (base64 raw)
 * @param {Object.<string,object>} memberPublicJwks - { peer_id: publicJwk } for RECIPIENTS only
 * @returns {string} JSON string stored in message content field
 */
export async function encryptGroup(plaintext, senderId, myPrivJwk, selfKeyB64, memberPublicJwks) {
  const msgKey = await crypto.subtle.generateKey(AES_ALGO, true, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, msgKey, enc.encode(plaintext))
  const rawMsgKey = await crypto.subtle.exportKey('raw', msgKey)

  const keys = {}

  // Wrap message key for each recipient using ECDH-derived shared key
  for (const [memberId, pubJwk] of Object.entries(memberPublicJwks)) {
    const sharedKey = await deriveSharedKey(myPrivJwk, pubJwk)
    const keyIv = crypto.getRandomValues(new Uint8Array(12))
    const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: keyIv }, sharedKey, rawMsgKey)
    keys[memberId] = b64enc(keyIv) + '.' + b64enc(wrapped)
  }

  // Wrap message key for sender's own copy using self-seal key
  const selfKey = await importSelfKey(selfKeyB64)
  const selfIv = crypto.getRandomValues(new Uint8Array(12))
  const selfWrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: selfIv }, selfKey, rawMsgKey)
  keys[senderId] = 'self.' + b64enc(selfIv) + '.' + b64enc(selfWrapped)

  return JSON.stringify({ ct: b64enc(ct), iv: b64enc(iv), keys })
}

/**
 * Decrypts a group message.
 * @param {string} encryptedJson - JSON string from message content field
 * @param {string} myPeerId
 * @param {object} myPrivJwk - my ECDH private key JWK
 * @param {object} senderPublicJwk - sender's ECDH public key JWK
 * @param {string} selfKeyB64 - my self-seal AES key (base64 raw)
 */
export async function decryptGroup(encryptedJson, myPeerId, myPrivJwk, senderPublicJwk, selfKeyB64) {
  const { ct, iv: ivB64, keys } = JSON.parse(encryptedJson)
  const myWrapped = keys[myPeerId]
  if (!myWrapped) throw new Error('no key for peer')

  let rawMsgKey
  if (myWrapped.startsWith('self.')) {
    // Sender's own copy — unwrap with self-seal key
    const parts = myWrapped.split('.')
    const selfKey = await importSelfKey(selfKeyB64)
    rawMsgKey = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64dec(parts[1]) },
      selfKey, b64dec(parts[2]),
    )
  } else {
    // Received copy — unwrap with ECDH(myPriv, senderPub)
    const [keyIvB64, wrappedB64] = myWrapped.split('.')
    const sharedKey = await deriveSharedKey(myPrivJwk, senderPublicJwk)
    rawMsgKey = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64dec(keyIvB64) },
      sharedKey, b64dec(wrappedB64),
    )
  }

  const msgKey = await crypto.subtle.importKey('raw', rawMsgKey, AES_ALGO, false, ['decrypt'])
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64dec(ivB64) },
    msgKey, b64dec(ct),
  )
  return dec.decode(plain)
}

// ---------------------------------------------------------------------------
// Safe wrappers — return original content on any failure (backward compat)
// ---------------------------------------------------------------------------

function looksEncryptedDirect(content) {
  if (typeof content !== 'string') return false
  const parts = content.split('.')
  return parts.length === 2 && parts.every(p => /^[A-Za-z0-9+/=]+$/.test(p) && p.length > 4)
}

function looksEncryptedGroup(content) {
  if (typeof content !== 'string') return false
  return content.startsWith('{') && content.includes('"ct"') && content.includes('"keys"')
}

export async function safeDecryptDirect(content, myPrivJwk, theirPubJwk) {
  if (!myPrivJwk || !theirPubJwk) return content
  if (!looksEncryptedDirect(content)) return content
  try {
    return await decryptDirect(content, myPrivJwk, theirPubJwk)
  } catch {
    return content
  }
}

export async function safeDecryptGroup(content, myPeerId, myPrivJwk, senderPublicJwk, selfKeyB64) {
  if (!myPrivJwk || !selfKeyB64) return content
  if (!looksEncryptedGroup(content)) return content
  try {
    return await decryptGroup(content, myPeerId, myPrivJwk, senderPublicJwk, selfKeyB64)
  } catch {
    return content
  }
}

export { looksEncryptedDirect, looksEncryptedGroup }
