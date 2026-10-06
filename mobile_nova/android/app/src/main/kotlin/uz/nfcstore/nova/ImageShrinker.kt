package uz.nfcstore.nova

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.os.Handler
import android.os.Looper
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.min

/**
 * Rasm yuklashdan oldin: uzun tomoni `maxSide` gacha, JPEG (Dart:
 * lib/core/media/image_prep.dart).
 *
 * `image_picker` PNG'ni siqmaydi — skrinshot 2 MB bo'lib ketardi, server
 * esa 700 KB dan kattasini qabul qilmaydi. Shaffof piksel bo'lsa, natija
 * kichraymasa yoki xato — `null` (Dart asl faylni yuboradi).
 */
object ImageShrinker {
    private val main = Handler(Looper.getMainLooper())

    fun toJpeg(path: String, out: String, maxSide: Int, quality: Int, result: MethodChannel.Result) {
        Thread {
            val res = try {
                shrink(path, out, maxSide, quality)
            } catch (_: Throwable) {
                File(out).delete()
                null
            }
            main.post { result.success(res) }
        }.start()
    }

    /**
     * SHAFFOF rasm (logotip, PNG): uzun tomoni `maxSide` gacha, PNG —
     * shaffoflik saqlanadi. JPEG'ga o'tkazib bo'lmaydi (fon qorayadi),
     * lekin 700 KB dan katta PNG server tomonidan rad etiladi
     * (audit 2026-10-06). Natija kichraymasa yoki xato — `null`.
     */
    fun toPng(path: String, out: String, maxSide: Int, result: MethodChannel.Result) {
        Thread {
            val res = try {
                shrinkPng(path, out, maxSide)
            } catch (_: Throwable) {
                File(out).delete()
                null
            }
            main.post { result.success(res) }
        }.start()
    }

    private fun shrinkPng(path: String, out: String, maxSide: Int): String? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(path, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSide) sample *= 2
        val decoded = BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample })
            ?: return null
        var bmp = decoded
        try {
            val scale = min(1.0, maxSide.toDouble() / max(bmp.width, bmp.height))
            if (scale < 1.0) {
                bmp = Bitmap.createScaledBitmap(
                    decoded,
                    max(1, (decoded.width * scale).toInt()),
                    max(1, (decoded.height * scale).toInt()),
                    true,
                )
            }
            FileOutputStream(out).use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
            val outFile = File(out)
            if (outFile.length() <= 0 || outFile.length() >= File(path).length()) {
                outFile.delete()
                return null
            }
            return out
        } finally {
            if (bmp !== decoded) bmp.recycle()
            decoded.recycle()
        }
    }

    private fun shrink(path: String, out: String, maxSide: Int, quality: Int): String? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(path, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSide) sample *= 2
        val decoded = BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample })
            ?: return null
        var bmp = decoded
        try {
            if (bmp.hasAlpha() && hasTransparency(bmp)) return null
            val scale = min(1.0, maxSide.toDouble() / max(bmp.width, bmp.height))
            val m = Matrix()
            if (scale < 1.0) m.postScale(scale.toFloat(), scale.toFloat())
            // BitmapFactory EXIF burilishini qo'llamaydi — o'zimiz buramiz.
            when (ExifInterface(path).getAttributeInt(
                ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                ExifInterface.ORIENTATION_ROTATE_90 -> m.postRotate(90f)
                ExifInterface.ORIENTATION_ROTATE_180 -> m.postRotate(180f)
                ExifInterface.ORIENTATION_ROTATE_270 -> m.postRotate(270f)
                ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> m.postScale(-1f, 1f)
                ExifInterface.ORIENTATION_FLIP_VERTICAL -> m.postScale(1f, -1f)
            }
            if (!m.isIdentity) {
                bmp = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, m, true)
            }
            FileOutputStream(out).use { bmp.compress(Bitmap.CompressFormat.JPEG, quality, it) }
            val outFile = File(out)
            if (outFile.length() <= 0 || outFile.length() >= File(path).length()) {
                outFile.delete()
                return null
            }
            return out
        } finally {
            if (bmp !== decoded) bmp.recycle()
            decoded.recycle()
        }
    }

    private fun hasTransparency(bmp: Bitmap): Boolean {
        val row = IntArray(bmp.width)
        for (y in 0 until bmp.height) {
            bmp.getPixels(row, 0, bmp.width, 0, y, bmp.width, 1)
            for (p in row) if ((p ushr 24) != 0xFF) return true
        }
        return false
    }
}
