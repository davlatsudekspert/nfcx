package uz.nfcstore.nova

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.Presentation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import io.flutter.plugin.common.MethodChannel
import java.io.File

/**
 * KATTA VIDEONI YUKLASHDAN OLDIN MOSLASH (egasi, 2026-09-28: "reels'da
 * katta video yuklashda o'zi moslash bormi" — "ha, albatta").
 *
 * iPhone'da bu `AVAssetExportSession` bilan qilinadi (AppDelegate.swift).
 * Android'da — Android'ning o'z Media3 Transformer'i (telefonning apparat
 * kodeki, tez): qisqa tomoni 1080 dan katta bo'lsa 1080 ga tushadi,
 * H.264 + AAC, ~6 Mbit/s. 4K 60 MB li video ~10-15 MB bo'ladi.
 *
 * Tegilmaydi: allaqachon kichik va yengil video (qisqa tomoni <= 1080 va
 * bitreyti <= 8 Mbit/s) — qayta siqish faqat sifatni yo'qotardi.
 * Xato bo'lsa `null` — Dart asl faylni yuboradi (yuklash to'xtamaydi).
 */
@OptIn(UnstableApi::class)
object VideoCompressor {
    private const val SHORT_SIDE = 1080
    private const val TARGET_BITRATE = 6_000_000
    private const val KEEP_BITRATE = 8_000_000

    fun compress(context: Context, path: String, outPath: String, result: MethodChannel.Result) {
        val src = File(path)
        if (!src.exists()) {
            result.success(null)
            return
        }
        var shortSide = 0
        var bitrate = 0
        try {
            val r = MediaMetadataRetriever()
            try {
                r.setDataSource(path)
                val w = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
                val h = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
                shortSide = minOf(w, h)
                bitrate = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE)?.toIntOrNull() ?: 0
            } finally {
                r.release()
            }
        } catch (_: Exception) {
            result.success(null)
            return
        }
        if (shortSide <= 0) {
            result.success(null)
            return
        }
        if (shortSide <= SHORT_SIDE && bitrate in 1..KEEP_BITRATE) {
            result.success(null)
            return
        }

        val videoEffects = if (shortSide > SHORT_SIDE) {
            listOf(Presentation.createForShortSide(SHORT_SIDE))
        } else {
            emptyList()
        }
        val item = EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(src)))
            .setEffects(Effects(emptyList(), videoEffects))
            .build()
        // HDR (yangi telefonlar kamerasi) oddiy SDR ga o'tadi — H.264 da
        // HDR saqlanmaydi, aks holda eksport xato berardi.
        val composition = Composition.Builder(EditedMediaItemSequence.Builder(item).build())
            .setHdrMode(Composition.HDR_MODE_TONE_MAP_HDR_TO_SDR_USING_OPEN_GL)
            .build()
        val out = File(outPath)
        out.delete()
        var answered = false
        val transformer = Transformer.Builder(context)
            .setVideoMimeType(MimeTypes.VIDEO_H264)
            .setAudioMimeType(MimeTypes.AUDIO_AAC)
            .setEncoderFactory(
                DefaultEncoderFactory.Builder(context)
                    .setRequestedVideoEncoderSettings(
                        VideoEncoderSettings.Builder().setBitrate(TARGET_BITRATE).build(),
                    )
                    .build(),
            )
            .addListener(object : Transformer.Listener {
                override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                    if (answered) return
                    answered = true
                    // Kichraymagan bo'lsa (kamdan-kam) — asl fayl yaxshiroq.
                    if (out.length() in 1 until src.length()) {
                        result.success(out.path)
                    } else {
                        out.delete()
                        result.success(null)
                    }
                }

                override fun onError(
                    composition: Composition,
                    exportResult: ExportResult,
                    exportException: ExportException,
                ) {
                    if (answered) return
                    answered = true
                    out.delete()
                    result.success(null)
                }
            })
            .build()
        try {
            transformer.start(composition, out.path)
        } catch (_: Exception) {
            if (!answered) {
                answered = true
                result.success(null)
            }
        }
    }
}
