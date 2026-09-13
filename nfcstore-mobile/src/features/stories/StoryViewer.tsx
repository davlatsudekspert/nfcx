import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getStoriesFeed } from '@/api/endpoints';
import type { StoryAuthor } from '@/api/types';
import { ChevronLeft } from '@/components/Glyphs';
import { Photo } from '@/components/Photo';
import { TapScale } from '@/components/TapScale';
import { tapLight } from '@/lib/haptics';
import { mediaUrl } from '@/lib/media';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

/** Bitta rasmli istorya necha millisekund turadi. */
const IMAGE_MS = 5000;

/**
 * TO'LIQ EKRANLI ISTORYA KO'RUVCHI.
 *
 * Boshqaruv (brif 8-bo'lim):
 *   o'ng tomonga bosish  -> keyingi istorya
 *   chap tomonga bosish  -> oldingi istorya
 *   bosib turish         -> to'xtatib turish
 *   pastga surish        -> yopish
 *   oxirgi istoryadan keyin -> keyingi MUALLIFGA o'tadi
 *
 * Ma'lumot `GET /api/stories/feed` dan keladi va u allaqachon
 * keshlangan bo'ladi (istorya qatori shu so'rovni ishlatadi), shuning
 * uchun ko'ruvchi darhol ochiladi.
 *
 * OLDINDAN YUKLASH: keyingi istoryaning rasmi `Image.prefetch()` bilan
 * fon rejimida olinadi. Bu bo'lmasa har o'tishda qora ekran ko'rinardi.
 */
export function StoryViewer() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { code } = useLocalSearchParams<{ code: string }>();

  const feed = useQuery({
    queryKey: ['stories', 'feed'],
    queryFn: getStoriesFeed,
    staleTime: 60_000,
  });

  const authors = useMemo(() => feed.data ?? [], [feed.data]);
  const startAuthor = Math.max(
    0,
    authors.findIndex((a) => a.code === code),
  );

  const [ai, setAi] = useState(0);
  const [si, setSi] = useState(0);
  const [paused, setPaused] = useState(false);

  // Ro'yxat kelgandan keyin boshlang'ich muallifga o'tamiz.
  const started = useRef(false);
  useEffect(() => {
    if (!started.current && authors.length) {
      started.current = true;
      setAi(startAuthor);
    }
  }, [authors.length, startAuthor]);

  const author: StoryAuthor | undefined = authors[ai];
  const story = author?.stories[si];

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/profile');
  }, []);

  const next = useCallback(() => {
    if (!author) return;
    if (si + 1 < author.stories.length) {
      setSi(si + 1);
      return;
    }
    if (ai + 1 < authors.length) {
      setAi(ai + 1);
      setSi(0);
      tapLight();
      return;
    }
    close();
  }, [ai, si, author, authors.length, close]);

  const prev = useCallback(() => {
    if (si > 0) {
      setSi(si - 1);
      return;
    }
    if (ai > 0) {
      const p = ai - 1;
      setAi(p);
      setSi(Math.max(0, authors[p].stories.length - 1));
      return;
    }
    // Birinchi istoryadan orqaga — shunchaki boshidan boshlaymiz.
    setSi(0);
  }, [ai, si, authors]);

  /* ── Vaqt chizig'i ─────────────────────────────────────────────── */
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!story) return;
    progress.value = 0;
    if (paused) return;
    // Video uzunligini oldindan bilmaymiz, shuning uchun chiziq rasm
    // bilan bir xil tezlikda yuradi va video tugasa `onEnd` uni
    // oldinga suradi.
    progress.value = withTiming(
      1,
      { duration: IMAGE_MS, easing: Easing.linear },
      (done) => {
        if (done) runOnJS(next)();
      },
    );
  }, [story, paused, progress, next]);

  /* ── Keyingi rasmni oldindan yuklash ───────────────────────────── */
  useEffect(() => {
    const upcoming: (string | undefined)[] = [
      author?.stories[si + 1]?.imageUrl,
      authors[ai + 1]?.stories[0]?.imageUrl,
    ];
    for (const u of upcoming) {
      const abs = mediaUrl(u);
      if (abs) Image.prefetch(abs, { cachePolicy: 'memory-disk' }).catch(() => {});
    }
  }, [author, authors, ai, si]);

  /* ── Pastga surib yopish ───────────────────────────────────────── */
  const dragY = useSharedValue(0);
  const pan = Gesture.Pan()
    .activeOffsetY(12)
    .failOffsetY(-12)
    .onUpdate((e) => {
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) {
        dragY.value = withTiming(height, { duration: 180 }, () => runOnJS(close)());
      } else {
        dragY.value = withTiming(0, { duration: 160 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
    // Pastga surganda fon ko'rinib boshlaydi — "yopilyapti" degan belgi.
    opacity: 1 - Math.min(dragY.value / (height * 0.7), 0.45),
  }));

  if (feed.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.a1} />
      </View>
    );
  }

  if (!author || !story) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#000',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          paddingHorizontal: 32,
        }}
      >
        <Text style={[sans(500, 13, 1.5), { color: 'rgba(255,255,255,.6)', textAlign: 'center' }]}>
          Ko’rsatadigan istorya yo’q.
        </Text>
        <TapScale
          radius={12}
          onPress={close}
          accessibilityLabel="Yopish"
          style={{
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,.1)',
          }}
        >
          <Text style={[sans(600, 13), { color: '#fff' }]}>Yopish</Text>
        </TapScale>
      </View>
    );
  }

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ flex: 1, backgroundColor: '#000' }, sheetStyle]}>
        <StoryMedia
          imageUrl={story.imageUrl}
          videoUrl={story.videoUrl}
          paused={paused}
          onEnd={next}
        />

        {/* Yuqoridagi qorayish — chiziq va ism o'qilishi uchun. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 160 + insets.top,
            backgroundColor: 'rgba(0,0,0,.45)',
          }}
        />

        {/* Vaqt chiziqlari — har bir istorya uchun bittadan. */}
        <View
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 10,
            right: 10,
            flexDirection: 'row',
            gap: 4,
          }}
        >
          {author.stories.map((s, i) => (
            <ProgressBar
              key={s.id}
              state={i < si ? 'done' : i === si ? 'active' : 'todo'}
              progress={progress}
            />
          ))}
        </View>

        {/* Muallif qatori */}
        <View
          style={{
            position: 'absolute',
            top: insets.top + 22,
            left: 12,
            right: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Photo uri={author.avatarUrl} width={34} height={34} radius={17} step={4} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[sans(700, 13, 1.2), { color: '#fff' }]} numberOfLines={1}>
              {author.name}
            </Text>
            <Text style={[mono(400, 10), { color: 'rgba(255,255,255,.6)', marginTop: 2 }]}>
              {timeAgo(story.createdAt)}
            </Text>
          </View>
          <TapScale
            radius={17}
            onPress={close}
            accessibilityLabel="Yopish"
            hitSlop={10}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,.35)',
            }}
          >
            <CloseGlyph />
          </TapScale>
        </View>

        {/* Bosish zonalari. ATAYLAB `Pressable`, `TapScale` emas:
            bu yerda ko'rinadigan tugma yo'q, faqat ekranning chap va
            o'ng yarmi. `onLongPress` bosib turganda to'xtatadi. */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' }}>
          <Pressable
            onPress={prev}
            onLongPress={() => setPaused(true)}
            onPressOut={() => setPaused(false)}
            delayLongPress={220}
            accessibilityLabel="Oldingi istorya"
            style={{ width: '32%' }}
          />
          <Pressable
            onPress={next}
            onLongPress={() => setPaused(true)}
            onPressOut={() => setPaused(false)}
            delayLongPress={220}
            accessibilityLabel="Keyingi istorya"
            style={{ flex: 1 }}
          />
        </View>

        {/* Izoh — pastda, qorayish ustida. */}
        {story.caption ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              paddingHorizontal: 18,
              paddingTop: 40,
              paddingBottom: 22 + insets.bottom,
              backgroundColor: 'rgba(0,0,0,.45)',
            }}
          >
            <Text style={[sans(500, 13, 1.55), { color: '#fff' }]} numberOfLines={4}>
              {story.caption}
            </Text>
          </View>
        ) : null}

        {/* Profilga o'tish */}
        <View
          style={{
            position: 'absolute',
            left: 12,
            bottom: 14 + insets.bottom,
          }}
        >
          <TapScale
            radius={12}
            onPress={() => router.replace(`/p/${author.code}`)}
            accessibilityLabel={`${author.name} profilini ochish`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: 'rgba(0,0,0,.45)',
            }}
          >
            <Text style={[sans(600, 12), { color: '#fff' }]}>Profilni ochish</Text>
            <View style={{ transform: [{ rotate: '180deg' }] }}>
              <ChevronLeft color="#fff" size={13} width={2} />
            </View>
          </TapScale>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Rasm yoki video — bittasi bo'ladi. */
function StoryMedia({
  imageUrl,
  videoUrl,
  paused,
  onEnd,
}: {
  imageUrl: string;
  videoUrl: string;
  paused: boolean;
  onEnd: () => void;
}) {
  const video = mediaUrl(videoUrl);
  if (video) return <StoryVideo uri={video} paused={paused} onEnd={onEnd} />;

  return (
    <Image
      source={{ uri: mediaUrl(imageUrl) }}
      contentFit="contain"
      transition={140}
      cachePolicy="memory-disk"
      style={{ flex: 1 }}
    />
  );
}

function StoryVideo({
  uri,
  paused,
  onEnd,
}: {
  uri: string;
  paused: boolean;
  onEnd: () => void;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);

  // Video tugaganda keyingisiga o'tamiz — vaqt chizig'i kutib
  // turmasligi uchun.
  useEffect(() => {
    const sub = player.addListener('playToEnd', onEnd);
    return () => sub.remove();
  }, [player, onEnd]);

  return (
    <VideoView
      player={player}
      contentFit="contain"
      nativeControls={false}
      style={{ flex: 1 }}
    />
  );
}

/** Bitta vaqt chizig'i. */
function ProgressBar({
  state,
  progress,
}: {
  state: 'done' | 'active' | 'todo';
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    width: state === 'done' ? '100%' : state === 'active' ? `${progress.value * 100}%` : '0%',
  }));

  return (
    <View
      style={{
        flex: 1,
        height: 2.5,
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,.28)',
      }}
    >
      <Animated.View style={[{ height: '100%', backgroundColor: '#fff' }, style]} />
    </View>
  );
}

function CloseGlyph() {
  return (
    <View style={{ width: 14, height: 14 }}>
      <View
        style={{
          position: 'absolute',
          top: 6,
          left: -1,
          width: 16,
          height: 2,
          borderRadius: 1,
          backgroundColor: '#fff',
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 6,
          left: -1,
          width: 16,
          height: 2,
          borderRadius: 1,
          backgroundColor: '#fff',
          transform: [{ rotate: '-45deg' }],
        }}
      />
    </View>
  );
}

/** "4 soat oldin" ko'rinishidagi vaqt. */
function timeAgo(iso: string): string {
  const ts = Date.parse(iso.replace(' ', 'T'));
  if (!Number.isFinite(ts)) return '';
  const min = Math.max(0, Math.round((Date.now() - ts) / 60_000));
  if (min < 1) return 'hozir';
  if (min < 60) return `${min} daqiqa oldin`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} soat oldin`;
  return `${Math.round(h / 24)} kun oldin`;
}
