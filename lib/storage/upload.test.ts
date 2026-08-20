/**
 * 2026-08  the WebP photo pipeline + CV format gate.
 *
 * Photo contracts:
 *   - any accepted input (JPEG/PNG/WebP) is stored as WebP + a 256px
 *     .thumb.webp sibling, both content-type image/webp
 *   - EXIF metadata does not survive the re-encode
 *   - oversized dimensions are capped (1600px longest edge)
 *   - deleteStorageObject sweeps the thumb with the main object
 *
 * CV contracts:
 *   - PDF, .doc (OLE), .docx (ZIP) accepted with matching magic bytes
 *   - images are rejected (no photos/scans of CVs)
 *   - claimed-type vs content mismatch is rejected
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));

// In-memory backend double  captures uploads/removals.
const stored = new Map<string, { bytes: Uint8Array; contentType: string }>();
vi.mock("./backend", () => ({
  getStorageBackend: async () => ({
    provider: "s3" as const,
    async upload(key: string, bytes: Uint8Array, contentType: string) {
      stored.set(key, { bytes, contentType });
    },
    async remove(key: string) {
      stored.delete(key);
    },
    async signedUrl() {
      return null;
    },
    async test() {
      return { ok: true, message: "" };
    },
  }),
}));

import {
  uploadPhoto,
  uploadCv,
  deleteStorageObject,
} from "./upload";
import { photoThumbKey, hasPhotoThumb } from "./keys";
import { StorageError } from "./config";

function asFile(bytes: Uint8Array | Buffer, name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

// Distinct user per test  the uploader rate-limits 5/10min per user.
let n = 0;
let user = "";
beforeEach(() => {
  stored.clear();
  user = `user_test-${++n}`;
});

describe("photo WebP pipeline", () => {
  test("JPEG with EXIF → capped WebP + thumb, metadata stripped", async () => {
    const jpeg = await sharp({
      create: {
        width: 2400,
        height: 1200,
        channels: 3,
        background: { r: 200, g: 120, b: 40 },
      },
    })
      .jpeg({ quality: 90 })
      .withMetadata({ exif: { IFD0: { Copyright: "GPSSECRET" } } })
      .toBuffer();
    expect(jpeg.includes(Buffer.from("GPSSECRET"))).toBe(true);

    const { key, mime } = await uploadPhoto({
      userId: user,
      id: "avatar",
      file: asFile(jpeg, "me.jpg", "image/jpeg"),
    });

    expect(key).toBe(`${user}/photos/avatar.webp`);
    expect(mime).toBe("image/webp");

    const main = stored.get(key);
    const thumb = stored.get(photoThumbKey(key));
    expect(main?.contentType).toBe("image/webp");
    expect(thumb?.contentType).toBe("image/webp");

    const mainMeta = await sharp(Buffer.from(main!.bytes)).metadata();
    expect(mainMeta.format).toBe("webp");
    expect(Math.max(mainMeta.width!, mainMeta.height!)).toBeLessThanOrEqual(1600);
    const thumbMeta = await sharp(Buffer.from(thumb!.bytes)).metadata();
    expect(Math.max(thumbMeta.width!, thumbMeta.height!)).toBeLessThanOrEqual(256);

    // The EXIF payload must not survive the re-encode.
    expect(Buffer.from(main!.bytes).includes(Buffer.from("GPSSECRET"))).toBe(false);
  });

  test("deleteStorageObject sweeps the thumb sibling", async () => {
    const png = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#333" },
    })
      .png()
      .toBuffer();
    const { key } = await uploadPhoto({
      userId: user,
      id: "avatar",
      file: asFile(png, "me.png", "image/png"),
    });
    expect(hasPhotoThumb(key)).toBe(true);
    expect(stored.size).toBe(2);

    await deleteStorageObject(key);
    expect(stored.size).toBe(0);
  });
});

describe("CV format gate", () => {
  const PDF = Buffer.from("%PDF-1.4 fake body for tests");
  const DOC = Buffer.concat([
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.from("legacy word"),
  ]);
  const DOCX = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from("zip container"),
  ]);
  const DOCX_MIME =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  test("accepts PDF, .doc and .docx with matching bytes", async () => {
    const pdf = await uploadCv({
      userId: user,
      id: "cv_a",
      file: asFile(PDF, "cv.pdf", "application/pdf"),
    });
    expect(pdf.key.endsWith(".pdf")).toBe(true);

    const doc = await uploadCv({
      userId: user,
      id: "cv_b",
      file: asFile(DOC, "cv.doc", "application/msword"),
    });
    expect(doc.key.endsWith(".doc")).toBe(true);

    const docx = await uploadCv({
      userId: user,
      id: "cv_c",
      file: asFile(DOCX, "cv.docx", DOCX_MIME),
    });
    expect(docx.key.endsWith(".docx")).toBe(true);
  });

  test("rejects an image posing as a CV (both honestly and disguised)", async () => {
    const png = await sharp({
      create: { width: 32, height: 32, channels: 3, background: "#000" },
    })
      .png()
      .toBuffer();

    // Honest image type → wrong_type.
    await expect(
      uploadCv({ userId: user, id: "cv_d", file: asFile(png, "cv.png", "image/png") }),
    ).rejects.toThrowError(StorageError);

    // PNG bytes claiming to be a PDF → bad_content.
    await expect(
      uploadCv({
        userId: user,
        id: "cv_e",
        file: asFile(png, "cv.pdf", "application/pdf"),
      }),
    ).rejects.toThrowError(StorageError);
  });
});
