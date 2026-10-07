package com.mangaflow.data

import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import androidx.documentfile.provider.DocumentFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.zip.ZipInputStream
import kotlin.coroutines.coroutineContext

data class Manga(val id: String, val title: String, val pageCount: Int, val coverPath: String?)

data class MangaPage(val path: String, val aspectRatio: Float)

/**
 * Stores imported manga in app-private storage (`files/library/<id>/page_00001.ext`), so
 * the reader never depends on external URIs and no storage permission is needed.
 */
class LibraryRepository(private val context: Context) {

    private val root = File(context.filesDir, "library").apply { mkdirs() }

    suspend fun list(): List<Manga> = withContext(Dispatchers.IO) {
        root.listFiles { f -> f.isDirectory }.orEmpty()
            .mapNotNull { dir ->
                val pages = pageFiles(dir)
                if (pages.isEmpty()) return@mapNotNull null
                Manga(
                    id = dir.name,
                    title = File(dir, TITLE_FILE).takeIf { it.exists() }?.readText()?.trim()
                        ?.ifEmpty { null } ?: dir.name,
                    pageCount = pages.size,
                    coverPath = pages.first().absolutePath,
                ) to dir.lastModified()
            }
            .sortedByDescending { it.second }
            .map { it.first }
    }

    suspend fun loadPages(id: String): List<MangaPage> = withContext(Dispatchers.IO) {
        pageFiles(File(root, id)).map { f ->
            val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(f.absolutePath, o)
            val ratio = if (o.outWidth > 0 && o.outHeight > 0) o.outWidth.toFloat() / o.outHeight else 0.7f
            MangaPage(f.absolutePath, ratio)
        }
    }

    suspend fun title(id: String): String = withContext(Dispatchers.IO) {
        File(File(root, id), TITLE_FILE).takeIf { it.exists() }?.readText()?.trim() ?: id
    }

    suspend fun delete(id: String) = withContext(Dispatchers.IO) {
        File(root, id).deleteRecursively()
        Unit
    }

    /** Import loose image files as one manga. Sorted by file name (natural order). */
    suspend fun importImages(uris: List<Uri>): Manga = withContext(Dispatchers.IO) {
        val named = uris.map { (displayName(it) ?: it.lastPathSegment ?: "page") to it }
            .filter { isImageName(it.first) }
            .sortedWith { a, b -> naturalCompare(a.first, b.first) }
        require(named.isNotEmpty()) { "No supported images selected" }
        val title = "Images " + java.text.SimpleDateFormat("MMM d, HH:mm", java.util.Locale.getDefault())
            .format(java.util.Date())
        createManga(title) { dir ->
            named.forEachIndexed { i, (name, uri) ->
                coroutineContext.ensureActive()
                context.contentResolver.openInputStream(uri)?.use { input ->
                    FileOutputStream(File(dir, pageName(i, name))).use { input.copyTo(it) }
                }
            }
        }
    }

    /** Import a folder (picked via the system tree picker); sub-folders are scanned too. */
    suspend fun importFolder(tree: Uri): Manga = withContext(Dispatchers.IO) {
        val rootDoc = requireNotNull(DocumentFile.fromTreeUri(context, tree)) { "Cannot open folder" }
        val found = ArrayList<Pair<String, DocumentFile>>()
        fun walk(dir: DocumentFile, prefix: String) {
            for (f in dir.listFiles()) {
                val name = f.name ?: continue
                if (f.isDirectory) walk(f, "$prefix$name/")
                else if (isImageName(name)) found += "$prefix$name" to f
            }
        }
        walk(rootDoc, "")
        require(found.isNotEmpty()) { "No supported images in folder" }
        found.sortWith { a, b -> naturalCompare(a.first, b.first) }
        createManga(rootDoc.name ?: "Folder") { dir ->
            found.forEachIndexed { i, (name, doc) ->
                coroutineContext.ensureActive()
                context.contentResolver.openInputStream(doc.uri)?.use { input ->
                    FileOutputStream(File(dir, pageName(i, name))).use { input.copyTo(it) }
                }
            }
        }
    }

    /** Import a .cbz (zip of images). Entry names are never used as paths (no zip-slip). */
    suspend fun importCbz(uri: Uri): Manga = withContext(Dispatchers.IO) {
        val title = (displayName(uri) ?: "Comic").substringBeforeLast('.')
        createManga(title) { dir ->
            val extracted = ArrayList<Pair<String, File>>()
            context.contentResolver.openInputStream(uri)?.buffered()?.use { raw ->
                ZipInputStream(raw).use { zis ->
                    var n = 0
                    while (true) {
                        coroutineContext.ensureActive()
                        val entry = zis.nextEntry ?: break
                        val base = entry.name.substringAfterLast('/')
                        if (entry.isDirectory || base.startsWith(".") ||
                            entry.name.startsWith("__MACOSX") || !isImageName(base)
                        ) continue
                        val tmp = File(dir, "tmp_${n++}.${base.substringAfterLast('.').lowercase()}")
                        FileOutputStream(tmp).use { zis.copyTo(it) }
                        extracted += entry.name to tmp
                    }
                }
            }
            extracted.sortWith { a, b -> naturalCompare(a.first, b.first) }
            extracted.forEachIndexed { i, (name, tmp) -> tmp.renameTo(File(dir, pageName(i, name))) }
        }
    }

    private inline fun createManga(title: String, fill: (File) -> Unit): Manga {
        val id = UUID.randomUUID().toString()
        val dir = File(root, id).apply { mkdirs() }
        try {
            fill(dir)
            val pages = pageFiles(dir)
            require(pages.isNotEmpty()) { "No supported images found" }
            File(dir, TITLE_FILE).writeText(title)
            return Manga(id, title, pages.size, pages.first().absolutePath)
        } catch (t: Throwable) {
            dir.deleteRecursively()
            throw t
        }
    }

    private fun pageFiles(dir: File): List<File> =
        dir.listFiles { f -> f.isFile && f.name.startsWith("page_") }.orEmpty().sortedBy { it.name }

    private fun pageName(index: Int, original: String): String =
        "page_%05d.%s".format(index, original.substringAfterLast('.', "jpg").lowercase())

    private fun displayName(uri: Uri): String? =
        runCatching {
            context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                ?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
        }.getOrNull()

    companion object {
        private const val TITLE_FILE = "title.txt"
        private val IMAGE_EXT = setOf("jpg", "jpeg", "png", "webp", "gif", "bmp")

        fun isImageName(name: String) = name.substringAfterLast('.', "").lowercase() in IMAGE_EXT

        /** Compares strings treating digit runs as numbers: "p2" < "p10". */
        fun naturalCompare(a: String, b: String): Int {
            var i = 0
            var j = 0
            while (i < a.length && j < b.length) {
                val ca = a[i]
                val cb = b[j]
                if (ca.isDigit() && cb.isDigit()) {
                    var ei = i
                    while (ei < a.length && a[ei].isDigit()) ei++
                    var ej = j
                    while (ej < b.length && b[ej].isDigit()) ej++
                    val na = a.substring(i, ei).trimStart('0')
                    val nb = b.substring(j, ej).trimStart('0')
                    if (na.length != nb.length) return na.length - nb.length
                    val c = na.compareTo(nb)
                    if (c != 0) return c
                    i = ei
                    j = ej
                } else {
                    val c = ca.lowercaseChar().compareTo(cb.lowercaseChar())
                    if (c != 0) return c
                    i++
                    j++
                }
            }
            return (a.length - i) - (b.length - j)
        }
    }
}
