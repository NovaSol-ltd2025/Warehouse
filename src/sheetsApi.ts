/**
 * ตัวเชื่อมต่อ Google Sheet (ผ่าน Google Apps Script Web App)
 * ดูฝั่งเซิร์ฟเวอร์ได้ที่ apps-script/Code.gs
 */

export interface SheetsConnection {
  apiUrl: string;
  apiToken: string;
}

export type CollectionName =
  | 'items'
  | 'suppliers'
  | 'branches'
  | 'branch_orders'
  | 'purchase_orders'
  | 'movements'
  | 'branch_demands';

export type DbOp =
  | { op: 'upsert'; collection: CollectionName; id: string; data: object; merge?: boolean }
  | { op: 'delete'; collection: CollectionName; id: string }
  | { op: 'replace'; collection: CollectionName; records: { id: string }[] };

export interface DbMeta {
  rev: number;
  seeded: boolean;
  counts: Record<string, number>;
}

export type DbSnapshot = Partial<Record<CollectionName, any[]>>;

const STORAGE_KEY = 'novasol.sheets.connection.v1';

export function loadConnection(): SheetsConnection {
  const envUrl = (import.meta.env.VITE_SHEETS_API_URL as string | undefined) || '';
  const envToken = (import.meta.env.VITE_SHEETS_API_TOKEN as string | undefined) || '';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<SheetsConnection>;
      if (saved.apiUrl) {
        return { apiUrl: saved.apiUrl, apiToken: saved.apiToken || '' };
      }
    }
  } catch {
    /* localStorage ใช้ไม่ได้ ข้ามไป */
  }
  return { apiUrl: envUrl, apiToken: envToken };
}

export function saveConnection(conn: SheetsConnection): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conn));
  } catch {
    /* ไม่เป็นไร ค่าจะอยู่แค่ในหน่วยความจำ */
  }
}

export function isConfigured(conn: SheetsConnection): boolean {
  return Boolean(conn.apiUrl.trim() && conn.apiToken.trim());
}

async function call<T>(conn: SheetsConnection, body: Record<string, unknown>, timeoutMs = 60000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    // ใช้ text/plain เพื่อไม่ให้เบราว์เซอร์ส่ง CORS preflight (Apps Script ไม่รองรับ OPTIONS)
    res = await fetch(conn.apiUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, token: conn.apiToken.trim() }),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('Google Sheet ตอบช้าเกินไป (หมดเวลา)');
    throw new Error(
      'เชื่อมต่อ Google Sheet ไม่ได้ — ตรวจสอบ URL, อินเทอร์เน็ต และว่า Web App ตั้งสิทธิ์เป็น "ทุกคน (Anyone)"'
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      'ได้รับคำตอบที่ไม่ใช่ข้อมูลจากสคริปต์ — มักเกิดจาก URL ไม่ใช่ลิงก์ /exec หรือ Web App ไม่ได้ตั้งสิทธิ์เป็น "ทุกคน (Anyone)"'
    );
  }
  if (!json.ok) throw new Error(json.error || 'Google Sheet ตอบกลับด้วยข้อผิดพลาด');
  return json as T;
}

export const sheetsApi = {
  meta: async (conn: SheetsConnection): Promise<DbMeta> =>
    (await call<{ meta: DbMeta }>(conn, { action: 'meta' }, 30000)).meta,

  getAll: async (conn: SheetsConnection): Promise<{ meta: DbMeta; data: DbSnapshot }> =>
    call<{ meta: DbMeta; data: DbSnapshot }>(conn, { action: 'getAll' }),

  apply: async (conn: SheetsConnection, ops: DbOp[]): Promise<{ rev: number; prevRev: number }> =>
    call<{ rev: number; prevRev: number }>(conn, { action: 'apply', ops }),

  seed: async (conn: SheetsConnection, data: DbSnapshot): Promise<void> => {
    await call(conn, { action: 'seed', data });
  },
};
