import { Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { sans } from '@/theme/type';

import type { ProfileVM } from '../useProfileData';
import { ActionButtons } from './ActionButtons';
import { OpenNowBadge, RoleLine, VerifiedBadge } from './Badges';
import { AvatarRing } from './AvatarRing';
import { ContactIconRow } from './ContactIconRow';
import { OrnamentLines } from './OrnamentLines';
import { StatsRow } from './StatsRow';

/**
 * Profil sarlavhasi — biznes va shaxsiy uchun BITTA komponent.
 *
 * Ikki tur orasidagi yagona farq shu yerda: biznesda "Hozir ochiq" +
 * ish vaqti, shaxsiyda esa rol qatori. Qolgani — bezak chiziqlari,
 * avatar halqasi, kontakt ikonkalari, statistika, Ulashish — aynan bir
 * xil, shuning uchun nusxalanmaydi.
 */
export function ProfileHeader({
  vm,
  hasNewContent,
  seen,
  onOpenPost,
  onFollow,
  onDashboard,
  onEdit,
}: {
  vm: ProfileVM;
  hasNewContent: boolean;
  seen: boolean;
  onOpenPost?: () => void;
  onFollow?: () => void;
  onDashboard?: () => void;
  onEdit?: () => void;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        alignItems: 'center',
        paddingTop: 2,
        paddingHorizontal: 22,
        paddingBottom: 14,
      }}
    >
      <OrnamentLines />

      <AvatarRing
        photoUrl={vm.photoUrl}
        hasNewContent={hasNewContent}
        seen={seen}
        hasMusic={vm.hasMusic}
        onPress={onOpenPost}
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: 13,
        }}
      >
        <Text
          style={[sans(800, 23, 1.2), { color: theme.ink, letterSpacing: -0.46 }]}
          numberOfLines={1}
        >
          {vm.name}
        </Text>
        {vm.verified ? <VerifiedBadge /> : null}
      </View>

      {vm.kind === 'business' && vm.openNow != null ? (
        <OpenNowBadge openNow={vm.openNow} hours={vm.hoursShort} />
      ) : null}
      {vm.kind === 'personal' ? <RoleLine role={vm.role} /> : null}

      {vm.phone || vm.city ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
            marginTop: 9,
          }}
        >
          {vm.phone ? (
            <Text style={[sans(500, 12.5), { color: 'rgba(255,255,255,.55)' }]}>
              {vm.phone}
            </Text>
          ) : null}
          {vm.phone && vm.city ? (
            <View
              style={{
                width: 3,
                height: 3,
                borderRadius: 1.5,
                backgroundColor: theme.a1,
              }}
            />
          ) : null}
          {vm.city ? (
            <Text style={[sans(500, 12.5), { color: 'rgba(255,255,255,.55)' }]}>
              {vm.city}
            </Text>
          ) : null}
        </View>
      ) : null}

      <StatsRow views={vm.views} followers={vm.followers} third={vm.third} />

      <ActionButtons
        isOwner={vm.isOwner}
        isBusiness={vm.kind === 'business'}
        following={vm.following}
        onFollow={onFollow}
        onDashboard={onDashboard}
        onEdit={onEdit}
        shareUrl={vm.shareUrl}
        shareTitle={vm.name}
      />

      <ContactIconRow {...vm.contacts} />
    </View>
  );
}
