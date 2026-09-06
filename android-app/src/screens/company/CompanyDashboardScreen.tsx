import React, { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import type { CompanyStackParamList } from '../../navigation/types';
import { CompanyScreen } from './CompanyScreen';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { PremiumInput } from '../../design-system/components/PremiumInput';
import { PremiumBadge } from '../../design-system/components/PremiumBadge';
import { PremiumStatCard } from '../../design-system/components/PremiumStatCard';
import { PremiumQueryState } from '../../design-system/components/PremiumQueryState';
import { useToast } from '../../design-system/components/PremiumToast';
import {
  ChoiceChip,
  CompanyCover,
  CompanyLogo,
  CompanyStatusChip,
  InfoRow,
  LifecycleRail,
  NoticeLine,
  SectionHeader,
} from './CompanyVisuals';
import { companiesApi } from '../../api/companies';
import { ApiError } from '../../api/client';
import { useCompany, useInvalidateCompany } from '../../hooks/useMyCompanies';
import { useAuthStore } from '../../state/authStore';
import { usePaymentsEnabledStore } from '../../state/paymentsEnabledStore';
import { pickAndUploadImage } from '../../native/imageUpload';
import {
  COMPANY_CATEGORIES,
  DESCRIPTION_MAX,
  absoluteUploadUrl,
  categoryLabel,
  companyPublicUrl,
  hasErrors,
  missingForSubmit,
  normalizeTelegram,
  normalizeWebsite,
  normalizeWhatsapp,
  validateBusiness,
  validateContacts,
} from './companyForm';
import { canSubmit, needsPayment, statusDescription } from './statusLabels';
import { formatCount, formatSom, safeText } from '../../lib/format';
import { color, space, type as typeTokens } from '../../design-system/tokens';
import type { Company } from '../../api/types';

type Props = NativeStackScreenProps<CompanyStackParamList, 'CompanyDashboard'>;

/**
 * The owner's workspace for one company — sections, not one long form:
 * overview (status + what to do next), business info, contacts, brand,
 * catalogue and public page. Every write goes through the real
 * `PATCH /api/companies/:id` and invalidates both this company and the
 * owner's list, so a status chip is never stale after an edit.
 */
export function CompanyDashboardScreen({ route, navigation }: Props) {
  const { companyId } = route.params;
  const company = useCompany(companyId);
  const c = company.data;

  const onShare = async () => {
    try {
      await Share.share({ message: companyPublicUrl(companyId), url: companyPublicUrl(companyId) });
    } catch {
      /* the user dismissed the share sheet — nothing to report */
    }
  };

  return (
    <CompanyScreen
      title={safeText(c?.displayName, 'Boshqaruv')}
      onBack={navigation.canGoBack() ? navigation.goBack : undefined}
      refreshing={company.isRefetching}
      onRefresh={() => void company.refetch()}
      actions={
        c?.status === 'active'
          ? [{ icon: 'share-2', accessibilityLabel: 'Havolani ulashish', onPress: () => void onShare() }]
          : undefined
      }
    >
      <PremiumQueryState
        isLoading={company.isLoading}
        isError={company.isError}
        error={company.error}
        onRetry={() => void company.refetch()}
        onUnauthorized={() => void useAuthStore.getState().logout()}
        isEmpty={company.isSuccess && !c}
        emptyIcon="briefcase"
        emptyTitle="Kompaniya topilmadi"
        emptyDescription="Bu Company ID sizga tegishli emas yoki o'chirilgan."
        skeletonRows={3}
        skeletonHeight={140}
      >
        {c ? <DashboardBody company={c} navigation={navigation} onShare={onShare} /> : null}
      </PremiumQueryState>
    </CompanyScreen>
  );
}

type EditSection = 'business' | 'contacts' | null;

function DashboardBody({
  company: c,
  navigation,
  onShare,
}: {
  company: Company;
  navigation: Props['navigation'];
  onShare: () => Promise<void>;
}) {
  const companyId = c.companyId;
  const toast = useToast();
  const invalidate = useInvalidateCompany(companyId);
  const paymentsStatus = usePaymentsEnabledStore((s) => s.status);

  const [editing, setEditing] = useState<EditSection>(null);
  const [paymentNote, setPaymentNote] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'logo' | 'cover' | null>(null);

  const [business, setBusiness] = useState({
    displayName: '',
    category: '',
    subcategory: '',
    city: '',
    address: '',
    description: '',
  });
  const [contacts, setContacts] = useState({ phone: '', telegram: '', whatsapp: '', website: '' });

  const update = useMutation({
    mutationFn: (patch: Partial<Company>) => companiesApi.update(companyId, patch),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.show('Saqlandi.', 'success');
    },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : 'Saqlab bo‘lmadi.', 'danger'),
  });

  const submit = useMutation({
    mutationFn: () => companiesApi.submit(companyId),
    onSuccess: () => {
      invalidate();
      toast.show("Ko'rib chiqishga yuborildi.", 'success');
    },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : 'Yuborilmadi.', 'danger'),
  });

  const payment = useMutation({
    mutationFn: () => companiesApi.beginPayment(companyId),
    onSuccess: (result) => {
      invalidate();
      setPaymentNote(safeText(result?.message, "So'rov yuborildi. Holatni kuting."));
    },
    onError: (e) => setPaymentNote(e instanceof ApiError ? e.message : "To'lov tizimi hozircha mavjud emas."),
  });

  const beginBusinessEdit = () => {
    setBusiness({
      displayName: c.displayName ?? '',
      category: c.category ?? '',
      subcategory: c.subcategory ?? '',
      city: c.city ?? '',
      address: c.address ?? '',
      description: c.description ?? '',
    });
    setEditing('business');
  };

  const beginContactsEdit = () => {
    setContacts({
      phone: c.phone ?? '',
      telegram: c.telegram ?? '',
      whatsapp: c.whatsapp ?? '',
      website: c.website ?? '',
    });
    setEditing('contacts');
  };

  const businessErrors = validateBusiness({
    displayName: business.displayName,
    city: business.city,
    phone: c.phone ?? '',
    description: business.description,
  });
  // Phone belongs to the contacts section — never block a business save on it.
  delete businessErrors.phone;
  const businessInvalid = hasErrors(businessErrors) || !business.category;

  const contactErrors = validateContacts(contacts);
  const phoneDigits = contacts.phone.replace(/\D/g, '');
  const phoneError = phoneDigits.length < 9 ? "Telefon raqami to'liq emas." : undefined;
  const contactsInvalid = hasErrors(contactErrors) || !!phoneError;

  const saveBusiness = () => {
    if (businessInvalid) return;
    const patch: Partial<Company> = {};
    if (business.displayName.trim() !== (c.displayName ?? '')) patch.displayName = business.displayName.trim();
    if (business.category !== (c.category ?? '')) patch.category = business.category;
    if (business.subcategory.trim() !== (c.subcategory ?? '')) patch.subcategory = business.subcategory.trim();
    if (business.city.trim() !== (c.city ?? '')) patch.city = business.city.trim();
    if (business.address.trim() !== (c.address ?? '')) patch.address = business.address.trim();
    if (business.description.trim() !== (c.description ?? '')) patch.description = business.description.trim();
    if (Object.keys(patch).length === 0) {
      setEditing(null);
      return;
    }
    update.mutate(patch);
  };

  const saveContacts = () => {
    if (contactsInvalid) return;
    const patch: Partial<Company> = {};
    const telegram = normalizeTelegram(contacts.telegram) ?? '';
    const whatsapp = normalizeWhatsapp(contacts.whatsapp) ?? '';
    const website = normalizeWebsite(contacts.website) ?? '';
    if (contacts.phone.trim() !== (c.phone ?? '')) patch.phone = contacts.phone.trim();
    if (telegram !== (c.telegram ?? '')) patch.telegram = telegram;
    if (whatsapp !== (c.whatsapp ?? '')) patch.whatsapp = whatsapp;
    if (website !== (c.website ?? '')) patch.website = website;
    if (Object.keys(patch).length === 0) {
      setEditing(null);
      return;
    }
    update.mutate(patch);
  };

  const pickImage = async (target: 'logo' | 'cover') => {
    if (uploading) return;
    setUploading(target);
    const result = await pickAndUploadImage();
    setUploading(null);
    if (result.status === 'ok') {
      update.mutate(target === 'logo' ? { logoUrl: absoluteUploadUrl(result.url) } : { coverUrl: absoluteUploadUrl(result.url) });
      return;
    }
    if (result.status === 'permission_denied') toast.show('Galereyaga ruxsat berilmagan.', 'warning');
    else if (result.status === 'error') toast.show('Rasm yuklanmadi.', 'danger');
  };

  const items = Array.isArray(c.items) ? c.items : null;
  const missing = missingForSubmit(c);
  const paymentsBlocked = paymentsStatus !== 'enabled';
  const isActive = c.status === 'active';

  return (
    <>
      {/* Overview */}
      <PremiumCard variant="featured" animate={false} contentStyle={styles.heroContent}>
        <View>
          <CompanyCover coverUrl={c.coverUrl} height={112} />
          <View style={styles.chipOverlay}>
            <CompanyStatusChip status={c.status} compact />
          </View>
        </View>
        <View style={styles.heroBody}>
          <View style={styles.heroRow}>
            <CompanyLogo logoUrl={c.logoUrl} displayName={c.displayName} size={56} style={styles.heroLogo} />
            <View style={styles.heroText}>
              <Text style={styles.heroName} numberOfLines={1}>
                {safeText(c.displayName)}
              </Text>
              <Text style={styles.heroId} numberOfLines={1}>
                #{safeText(c.companyId)}
              </Text>
            </View>
          </View>

          <View style={styles.tierRow}>
            <PremiumBadge label={String(c.tier ?? '').toUpperCase() || 'TARIF'} tone={c.tier} />
            {!isActive && <Text style={styles.tierPrice}>{formatSom(c.price)}</Text>}
          </View>

          <View style={styles.railWrap}>
            <LifecycleRail status={c.status} />
          </View>

          <Text style={styles.statusText}>{statusDescription(c.status)}</Text>

          <View style={styles.heroActions}>
            {canSubmit(c.status) && (
              <>
                {missing.length > 0 && (
                  <NoticeLine
                    icon="alert-triangle"
                    tone="warning"
                    text={`Yuborishdan oldin to'ldiring: ${missing.join(', ')}.`}
                  />
                )}
                <PremiumButton
                  label={c.status === 'rejected' ? 'Qayta yuborish' : "Ko'rib chiqishga yuborish"}
                  onPress={() => submit.mutate()}
                  loading={submit.isPending}
                  disabled={missing.length > 0 || submit.isPending}
                />
              </>
            )}

            {c.status === 'pending_review' && (
              <>
                <NoticeLine icon="clock" text="Admin javobini kutmoqdasiz. Ma'lumotlarni hozir ham tahrirlashingiz mumkin." />
                <PremiumButton label="Holatni yangilash" variant="ghost" onPress={() => invalidate()} />
              </>
            )}

            {needsPayment(c.status) && (
              <>
                <NoticeLine
                  icon={paymentsBlocked ? 'lock' : 'credit-card'}
                  tone={paymentsBlocked ? 'warning' : 'muted'}
                  text={
                    paymentsBlocked
                      ? "To'lovlar hozircha yopiq. Yoqilishi bilan shu tugma ishlaydi — hech narsa yo'qolmaydi."
                      : "To'lovni boshlang — tasdiqlangach profil avtomatik faollashadi."
                  }
                />
                <PremiumButton
                  label={c.status === 'payment_pending' ? "To'lovni tekshirish" : "To'lovni boshlash"}
                  onPress={() => {
                    setPaymentNote(null);
                    payment.mutate();
                  }}
                  loading={payment.isPending}
                  disabled={paymentsBlocked || payment.isPending}
                />
                {paymentNote ? <NoticeLine icon="info" tone="warning" text={paymentNote} /> : null}
              </>
            )}

            {isActive && (
              <PremiumButton
                label="Ochiq sahifani ko'rish"
                onPress={() => navigation.navigate('PublicCompany', { companyId })}
              />
            )}
          </View>
        </View>
      </PremiumCard>

      {/* Live counters — only from fields the API actually returned */}
      {items || c.gallery ? (
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <PremiumStatCard label="Katalog" value={items?.length ?? 0} formatValue={formatCount} />
          </View>
          <View style={styles.statItem}>
            <PremiumStatCard
              label="Sotuvda"
              value={items ? items.filter((i) => i.available).length : 0}
              formatValue={formatCount}
            />
          </View>
          <View style={styles.statItem}>
            <PremiumStatCard label="Galereya" value={c.gallery?.length ?? 0} formatValue={formatCount} />
          </View>
        </View>
      ) : null}

      {/* Business info */}
      <PremiumCard animate={false}>
        <SectionHeader
          title="BIZNES MA'LUMOTLARI"
          actionLabel={editing === 'business' ? 'Bekor qilish' : 'Tahrirlash'}
          actionIcon={editing === 'business' ? 'x' : 'edit-2'}
          onPressAction={editing === 'business' ? () => setEditing(null) : beginBusinessEdit}
        />

        {editing === 'business' ? (
          <>
            <PremiumInput
              label="Kompaniya nomi"
              value={business.displayName}
              onChangeText={(t) => setBusiness((b) => ({ ...b, displayName: t }))}
              error={businessErrors.displayName ?? null}
            />
            <Text style={styles.fieldLabel}>Kategoriya</Text>
            <View style={styles.chips}>
              {COMPANY_CATEGORIES.map((cat) => (
                <ChoiceChip
                  key={cat.slug}
                  label={cat.label}
                  selected={business.category === cat.slug}
                  onPress={() => setBusiness((b) => ({ ...b, category: cat.slug }))}
                />
              ))}
            </View>
            <View style={styles.chipsSpacer} />
            <PremiumInput
              label="Yo'nalish (ixtiyoriy)"
              value={business.subcategory}
              onChangeText={(t) => setBusiness((b) => ({ ...b, subcategory: t }))}
            />
            <PremiumInput
              label="Shahar"
              value={business.city}
              onChangeText={(t) => setBusiness((b) => ({ ...b, city: t }))}
              error={businessErrors.city ?? null}
            />
            <PremiumInput
              label="Manzil (ixtiyoriy)"
              value={business.address}
              onChangeText={(t) => setBusiness((b) => ({ ...b, address: t }))}
            />
            <PremiumInput
              label="Tavsif"
              value={business.description}
              onChangeText={(t) => setBusiness((b) => ({ ...b, description: t.slice(0, DESCRIPTION_MAX) }))}
              multiline
              numberOfLines={5}
              style={styles.textArea}
              error={businessErrors.description ?? null}
            />
            <PremiumButton
              label="Saqlash"
              onPress={saveBusiness}
              loading={update.isPending}
              disabled={businessInvalid || update.isPending}
            />
          </>
        ) : (
          <>
            <InfoRow icon="tag" label="Kategoriya" value={categoryLabel(c.category)} />
            {!!c.subcategory && <InfoRow icon="corner-down-right" label="Yo'nalish" value={c.subcategory} />}
            <InfoRow icon="map-pin" label="Shahar" value={c.city} />
            <InfoRow icon="navigation" label="Manzil" value={c.address} />
            <Text style={styles.description}>{safeText(c.description, 'Tavsif kiritilmagan.')}</Text>
          </>
        )}
      </PremiumCard>

      {/* Contacts */}
      <PremiumCard animate={false}>
        <SectionHeader
          title="ALOQA"
          actionLabel={editing === 'contacts' ? 'Bekor qilish' : 'Tahrirlash'}
          actionIcon={editing === 'contacts' ? 'x' : 'edit-2'}
          onPressAction={editing === 'contacts' ? () => setEditing(null) : beginContactsEdit}
        />

        {editing === 'contacts' ? (
          <>
            <PremiumInput
              label="Telefon"
              value={contacts.phone}
              onChangeText={(t) => setContacts((v) => ({ ...v, phone: t }))}
              keyboardType="phone-pad"
              error={phoneError ?? null}
            />
            <PremiumInput
              label="Telegram username"
              value={contacts.telegram}
              onChangeText={(t) => setContacts((v) => ({ ...v, telegram: t }))}
              autoCapitalize="none"
              autoCorrect={false}
              error={contactErrors.telegram ?? null}
            />
            <PremiumInput
              label="WhatsApp raqami"
              value={contacts.whatsapp}
              onChangeText={(t) => setContacts((v) => ({ ...v, whatsapp: t }))}
              keyboardType="phone-pad"
              error={contactErrors.whatsapp ?? null}
            />
            <PremiumInput
              label="Veb-sayt"
              value={contacts.website}
              onChangeText={(t) => setContacts((v) => ({ ...v, website: t }))}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              error={contactErrors.website ?? null}
            />
            <PremiumButton
              label="Saqlash"
              onPress={saveContacts}
              loading={update.isPending}
              disabled={contactsInvalid || update.isPending}
            />
          </>
        ) : (
          <>
            <InfoRow icon="phone" label="Telefon" value={c.phone} />
            <InfoRow icon="send" label="Telegram" value={c.telegram} />
            <InfoRow icon="message-circle" label="WhatsApp" value={c.whatsapp} />
            <InfoRow icon="globe" label="Veb-sayt" value={c.website} />
          </>
        )}
      </PremiumCard>

      {/* Brand */}
      <PremiumCard animate={false}>
        <SectionHeader title="BREND" />
        <View style={styles.brandRow}>
          <CompanyLogo logoUrl={c.logoUrl} displayName={c.displayName} size={64} />
          <View style={styles.brandActions}>
            <PremiumButton
              label={c.logoUrl ? "Logotipni almashtirish" : 'Logotip yuklash'}
              variant="ghost"
              onPress={() => void pickImage('logo')}
              loading={uploading === 'logo'}
              disabled={uploading !== null}
            />
            <PremiumButton
              label={c.coverUrl ? 'Muqovani almashtirish' : 'Muqova yuklash'}
              variant="ghost"
              onPress={() => void pickImage('cover')}
              loading={uploading === 'cover'}
              disabled={uploading !== null}
            />
          </View>
        </View>
      </PremiumCard>

      {/* Catalogue */}
      <PremiumCard animate={false}>
        <SectionHeader title="KATALOG" />
        <Text style={styles.sectionBody}>
          {items
            ? `${formatCount(items.length)} ta element · ${formatCount(items.filter((i) => i.available).length)} tasi sotuvda`
            : 'Katalog elementlarini qo‘shing — ular ochiq sahifada ko‘rinadi.'}
        </Text>
        <PremiumButton
          label="Katalogni boshqarish"
          variant="ghost"
          onPress={() => navigation.navigate('CatalogList', { companyId })}
          style={styles.sectionButton}
        />
      </PremiumCard>

      {/* Public page */}
      <PremiumCard animate={false}>
        <SectionHeader title="OCHIQ SAHIFA" />
        <Text style={styles.sectionBody}>{companyPublicUrl(companyId)}</Text>
        {!isActive && (
          <View style={styles.noticeWrap}>
            <NoticeLine icon="eye-off" text="Sahifa faollashmaguncha faqat siz ko'ra olasiz." />
          </View>
        )}
        <PremiumButton
          label={isActive ? "Sahifani ko'rish" : "Ko'rinishini tekshirish"}
          variant="ghost"
          onPress={() => navigation.navigate('PublicCompany', { companyId })}
          style={styles.sectionButton}
        />
        {isActive && (
          <PremiumButton
            label="Havolani ulashish"
            variant="ghost"
            onPress={() => void onShare()}
            style={styles.sectionButton}
          />
        )}
      </PremiumCard>
    </>
  );
}

const styles = StyleSheet.create({
  heroContent: { padding: 0 },
  chipOverlay: { position: 'absolute', top: space.md, right: space.md },
  heroBody: { padding: space.lg, paddingTop: 0, marginTop: -22 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  heroLogo: { borderWidth: 2, borderColor: color.bg },
  heroText: { flex: 1, paddingBottom: 2 },
  heroName: { ...typeTokens.h2, color: color.textPrimary },
  heroId: { ...typeTokens.mono, fontSize: 13, color: color.gold },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  tierPrice: { ...typeTokens.bodyStrong, color: color.textSecondary },
  railWrap: { marginTop: space.lg },
  statusText: { ...typeTokens.caption, color: color.textSecondary, marginTop: space.lg, lineHeight: 18 },
  heroActions: { gap: space.md, marginTop: space.lg },

  statRow: { flexDirection: 'row', gap: space.sm },
  statItem: { flex: 1 },

  fieldLabel: { ...typeTokens.caption, color: color.textSecondary, marginBottom: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chipsSpacer: { height: space.md },
  textArea: { minHeight: 112, paddingTop: space.md, textAlignVertical: 'top' },

  description: { ...typeTokens.body, color: color.textSecondary, marginTop: space.md, lineHeight: 21 },
  sectionBody: { ...typeTokens.caption, color: color.textSecondary, lineHeight: 18 },
  sectionButton: { marginTop: space.md },
  noticeWrap: { marginTop: space.md },

  brandRow: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  brandActions: { flex: 1, gap: space.sm },
});
