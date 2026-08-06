import 'server-only';

/**
 * Guarded re-export of originalFilenameMetadata.serverCore.ts - importing
 * `server-only` makes the build fail loudly if this module is ever
 * bundled for the browser by mistake. Production code (documentActions.ts)
 * must import from here, never from .serverCore directly; unit tests
 * import .serverCore directly to avoid any dependency on server-only's
 * runtime environment check under Vitest.
 *
 * Root cause this whole mechanism exists to fix: Next.js's Server Action
 * FormData transport decodes a non-ASCII multipart filename parameter as
 * Latin-1 before the Server Action ever receives it (verified directly via
 * a six-boundary trace, P014) - browser File.name is never trusted as the
 * canonical filename as a result.
 */
export {
  MAX_ENCODED_ORIGINAL_FILENAME_LENGTH,
  decodeOriginalFilenameUtf8Base64Url,
  resolveOriginalFilenameFromFormData,
  type DecodeOriginalFilenameResult,
  type ResolveOriginalFilenameResult,
} from './originalFilenameMetadata.serverCore';
