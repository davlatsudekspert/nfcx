import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import Svg, { Path } from 'react-native-svg';

import type { CompanyStory } from '@/api/types';
import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';
import { MOTION } from '@/theme/tokens';

/**
 * To'liq ekran Story ko'ruvchi.
 *
 * Handoff spec: "Story progress: Linear segment fill, 5s per image,
 * pause on long-press." Video story uchun (`videoUrl` bor, `imageUrl`
 * yo'q) — loyihada video pleer kutubxonasi YO'Q, shuning uchun soxta/
 * ishlamaydigan pleer chizib qo'yilmadi: rasm o'rniga "Videoni saytda
 * ko'rish" tugmasi ko'rsatiladi (haqiqiy story sahifasiga olib boradi).
 */
export function StoryViewer({
  stories,
  startIndex,
  onClose,
}: {
  stories: CompanyStory[];
  startIndex: number;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(startIndex);
  const progress = useSharedValue(0);
  const paused = useRef(false);

  const story = stories[index];

  const goNext = () => {
    if (index >= stories.length - 1) {
      onClose();
      return;
    }
    setIndex((i) => i + 1);
  };

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: MOTION.storyProgressMs,
      easing: Easing.linear,
    });
    const timer = setTimeout(() => {
      if (!paused.current) goNext();
    }, MOTION.storyProgressMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  if (!story) return null;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {story.imageUrl ? (
          <Image
            source={{ uri: story.imageUrl }}
            contentFit="cover"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 32,
              gap: 16,
            }}
          >
            <Text style={[sans(500, 13, 1.5), { color: 'rgba(255,255,255,.7)', textAlign: 'center' }]}>
              Bu — video story. Ko’rish uchun brauzerda oching.
            </Text>
          </View>
        )}

        {/* Progress segmentlari */}
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
          {stories.map((s, i) => (
            <View
              key={s.id}
              style={{
                flex: 1,
                height: 2.5,
                borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,.28)',
                overflow: 'hidden',
              }}
            >
              {i === index ? (
                <Animated.View
                  style={[{ height: '100%', backgroundColor: theme.a1 }, barStyle]}
                />
              ) : i < index ? (
                <View style={{ height: '100%', backgroundColor: theme.a1 }} />
              ) : null}
            </View>
          ))}
        </View>

        <Pressable
          onPress={onClose}
          accessibilityLabel="Yopish"
          style={{
            position: 'absolute',
            top: insets.top + 16,
            right: 12,
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <Path
              d="M5 5l14 14M19 5L5 19"
              stroke="#fff"
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        </Pressable>

        {/* Tap navigatsiyasi: chap 1/3 — orqaga, o'ng 2/3 — oldinga. */}
        <View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, flexDirection: 'row' }}>
          <Pressable
            onPress={goPrev}
            onLongPress={() => {
              paused.current = true;
            }}
            onPressOut={() => {
              paused.current = false;
            }}
            style={{ flex: 1 }}
          />
          <Pressable
            onPress={goNext}
            onLongPress={() => {
              paused.current = true;
            }}
            onPressOut={() => {
              paused.current = false;
            }}
            style={{ flex: 2 }}
          />
        </View>

        {!story.imageUrl && story.videoUrl ? (
          <Pressable
            onPress={() => WebBrowser.openBrowserAsync(story.videoUrl!).catch(() => {})}
            style={{
              position: 'absolute',
              bottom: insets.bottom + 24,
              left: 24,
              right: 24,
              paddingVertical: 12,
              borderRadius: 13,
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,.12)',
            }}
          >
            <Text style={[sans(600, 13), { color: '#fff' }]}>Brauzerda ochish</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}
