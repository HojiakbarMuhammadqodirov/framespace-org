// A tiny file-backed JSON document store. One process owns the file; every
// mutation is serialised through a promise queue and written atomically
// (write temp file -> fsync -> rename), so a crash mid-write can never leave a
// half-written file behind.

import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

export async function atomicWriteJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
  const handle = await fs.open(tmp, 'w', 0o600)
  try {
    await handle.writeFile(JSON.stringify(value, null, 2))
    await handle.sync()
  } finally {
    await handle.close()
  }
  try {
    await fs.rename(tmp, file)
  } catch (err) {
    // Windows can briefly lock the target (antivirus, indexer). Retry once.
    if (err.code === 'EPERM' || err.code === 'EBUSY') {
      await new Promise((r) => setTimeout(r, 50))
      await fs.rename(tmp, file)
    } else {
      await fs.rm(tmp, { force: true })
      throw err
    }
  }
}

export class JsonStore {
  /**
   * @param {string} file
   * @param {() => any} initial
   */
  constructor(file, initial) {
    this.file = file
    this.initial = initial
    this.data = null
    this.queue = Promise.resolve()
  }

  async load() {
    if (this.data) return this.data
    try {
      this.data = JSON.parse(await fs.readFile(this.file, 'utf8'))
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // Corrupt file: keep it for inspection rather than overwrite silently.
        const backup = `${this.file}.corrupt-${Date.now()}`
        await fs.rename(this.file, backup).catch(() => {})
        console.error(`[store] ${this.file} unreadable (${err.message}); moved to ${backup}`)
      }
      this.data = this.initial()
    }
    return this.data
  }

  /** Read-only snapshot access. */
  async read(fn) {
    await this.queue
    return fn(await this.load())
  }

  /**
   * Mutate under the lock. `fn` may change `data` in place and return a value;
   * the file is persisted before the promise resolves.
   */
  update(fn) {
    const run = this.queue.then(async () => {
      const data = await this.load()
      const result = await fn(data)
      await atomicWriteJson(this.file, data)
      return result
    })
    this.queue = run.catch(() => {})
    return run
  }
}
