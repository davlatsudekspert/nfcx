import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { color, depth, gradient, radius, space, type as typeTokens } from '../tokens';

type ToastTone = 'success' | 'warning' | 'danger' | 'info';
interface ToastItem { id: number; message: string; tone: ToastTone }

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <PremiumToastProvider>');
  return ctx;
}

const TONE_COLOR: Record<ToastTone, string> = {
  success: color.success,
  warning: color.warning,
  danger: color.danger,
  info: color.gold,
};

/** The slab's shadow plus a soft glow in the toast's own colour. */
const TONE_DEPTH: Record<ToastTone, { boxShadow: string }> = {
  success: { boxShadow: `${depth.card.boxShadow}, 0 0 24px rgba(74,222,128,0.22)` },
  warning: { boxShadow: `${depth.card.boxShadow}, 0 0 24px rgba(224,179,74,0.22)` },
  danger: { boxShadow: `${depth.card.boxShadow}, 0 0 24px rgba(229,72,77,0.22)` },
  info: { boxShadow: `${depth.card.boxShadow}, 0 0 24px rgba(212,175,90,0.28)` },
};

const TONE_ICON: Record<ToastTone, React.ComponentProps<typeof Feather>['name']> = {
  success: 'check-circle',
  warning: 'alert-triangle',
  danger: 'alert-octagon',
  info: 'info',
};

const TOP_LIP = ['rgba(255,238,196,0.22)', 'rgba(255,238,196,0.04)', 'transparent'] as const;

const TOAST_MS = 3200;

/** Queues toasts rather than overlapping them — see android/docs/05-DESIGN_SYSTEM.md §5.2.
 * The toast is a small slab of the card material with a coloured rail and a
 * glow in its own tone, so it reads as an object landing on the screen. */
export function PremiumToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const show = useCallback((message: string, tone: ToastTone = 'info') => {
    const text = typeof message === 'string' ? message.trim() : '';
    if (!text) return;
    const id = nextId.current++;
    setQueue((q) => [...q, { id, message: text, tone }]);
    const timer = setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== timer);
      setQueue((q) => q.filter((t) => t.id !== id));
    }, TOAST_MS);
    timers.current.push(timer);
  }, []);

  /* Clear any in-flight dismiss timers if the provider unmounts, so a
     setState never lands on a torn-down tree. */
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const current = queue[0];
  const tint = current ? (TONE_COLOR[current.tone] ?? color.gold) : color.gold;
  const toneDepth = current ? (TONE_DEPTH[current.tone] ?? depth.card) : depth.card;

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {current && (
        <Animated.View
          key={current.id}
          entering={SlideInDown.duration(220)}
          exiting={SlideOutDown.duration(180)}
          style={[styles.wrapper, toneDepth]}
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          <LinearGradient
            colors={gradient.cardSurface}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient colors={TOP_LIP} style={styles.lip} pointerEvents="none" />
          <View style={[styles.rail, { backgroundColor: tint, boxShadow: `0 0 10px ${tint}` }]} />
          <View style={styles.iconWrap}>
            <Feather name={TONE_ICON[current.tone] ?? 'info'} size={16} color={tint} />
          </View>
          <Text style={styles.text} numberOfLines={3}>
            {current.message}
          </Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderGold,
    backgroundColor: color.surface,
    overflow: 'hidden',
    paddingVertical: space.md,
    paddingRight: space.md,
  },
  lip: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  rail: { width: 3, alignSelf: 'stretch', borderRadius: radius.pill },
  iconWrap: { paddingHorizontal: space.md },
  text: { ...typeTokens.body, color: color.textPrimary, flex: 1 },
});
