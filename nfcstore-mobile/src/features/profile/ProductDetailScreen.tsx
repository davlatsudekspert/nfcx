import { useMutation, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getCompany, placeCompanyOrder } from '@/api/endpoints';
import { ApiError } from '@/api/client';
import { BackBar } from '@/components/BackBar';
import { Card } from '@/components/Card';
import { GoldButton } from '@/components/GoldButton';
import { StripeFill } from '@/components/StripeFill';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { mono, sans } from '@/theme/type';

/**
 * Mahsulot/xizmat detali — company.catalog ichidan, ALOHIDA endpoint
 * KERAK EMAS: `['company', companyId]` bilan bir xil query kaliti
 * ishlatiladi, shuning uchun ProfilView'dan kelinganda kesh allaqachon
 * to'liq (qo'shimcha tarmoq so'rovi yo'q).
 *
 * Buyurtma berish — `POST /api/companies/:id/orders`, production
 * Worker'da tasdiqlangan, egalik talab qilinmaydi. Nom/narx SERVERDA
 * katalogdan olinadi, mijoz yubormaydi.
 */
export function ProductDetailScreen({
  companyId,
  itemId,
}: {
  companyId: string;
  itemId: string;
}) {
  const { theme } = useTheme();

  const companyQuery = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => getCompany(companyId),
  });

  const item = companyQuery.data?.catalog.find((i) => i.id === itemId);
  const hasPromo = item && item.promotionPrice != null && item.promotionPrice < item.price;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [qty, setQty] = useState('1');
  const [note, setNote] = useState('');

  const order = useMutation({
    mutationFn: () =>
      placeCompanyOrder(companyId, {
        itemId,
        name: name.trim(),
        phone: phone.trim(),
        qty: Math.max(1, Math.round(Number(qty) || 1)),
        note: note.trim() || undefined,
      }),
  });

  if (companyQuery.isLoading && !companyQuery.data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <BackBar title="Mahsulot" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.a1} />
        </View>
      </View>
    );
  }

  if (companyQuery.isError || !item) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <BackBar title="Mahsulot" />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
            gap: 14,
          }}
        >
          <Text style={[sans(500, 13, 1.5), { color: theme.off, textAlign: 'center' }]}>
            {companyQuery.isError
              ? 'Ma’lumotni yuklab bo’lmadi. Internetni tekshirib qayta urinib ko’ring.'
              : 'Bu mahsulot topilmadi — o’chirilgan yoki mavjud emas bo’lishi mumkin.'}
          </Text>
        </View>
      </View>
    );
  }

  const unavailable = item.available === false;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <BackBar title={item.name} subtitle={companyQuery.data?.displayName} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
      >
        <View style={{ width: '100%', aspectRatio: 1, borderRadius: 18, overflow: 'hidden' }}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} contentFit="cover" style={{ flex: 1 }} />
          ) : (
            <StripeFill step={9} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[mono(400, 9, 1.4), { color: theme.phInk }]}>PRODUCT SHOT 1:1</Text>
            </StripeFill>
          )}
        </View>

        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={[sans(800, 19, 1.25), { color: theme.ink, flex: 1 }]}>{item.name}</Text>
            {unavailable ? (
              <View
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 9,
                  borderRadius: 7,
                  borderWidth: 1,
                  borderColor: theme.signal,
                }}
              >
                <Text style={[mono(600, 9.5), { color: theme.signal, letterSpacing: 0.4 }]}>
                  MAVJUD EMAS
                </Text>
              </View>
            ) : null}
          </View>
          {item.category ? (
            <Text style={[mono(500, 10.5), { color: theme.ash, letterSpacing: 0.4 }]}>
              {item.category.toUpperCase()}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[mono(600, 17), { color: theme.a1 }]}>
              {money(hasPromo ? item.promotionPrice! : item.price)}
            </Text>
            {hasPromo ? (
              <Text
                style={[
                  mono(400, 13),
                  { color: 'rgba(255,255,255,.35)', textDecorationLine: 'line-through' },
                ]}
              >
                {money(item.price)}
              </Text>
            ) : null}
          </View>
          {item.description ? (
            <Text style={[sans(400, 13, 1.55), { color: 'rgba(255,255,255,.65)', marginTop: 4 }]}>
              {item.description}
            </Text>
          ) : null}
        </View>

        {!unavailable ? (
          <Card radius={16} style={{ padding: 16, gap: 12 }}>
            <Text style={[mono(600, 11), { color: theme.a1, letterSpacing: 1.1 }]}>
              BUYURTMA BERISH
            </Text>

            {order.isSuccess ? (
              <Text style={[sans(600, 13, 1.4), { color: theme.verdant }]}>
                Buyurtma qabul qilindi. Egasi tez orada siz bilan bog’lanadi.
              </Text>
            ) : (
              <>
                <FieldInput placeholder="Ismingiz" value={name} onChangeText={setName} />
                <FieldInput
                  placeholder="Telefon raqamingiz"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
                <FieldInput
                  placeholder="Miqdor"
                  value={qty}
                  onChangeText={setQty}
                  keyboardType="number-pad"
                />
                <FieldInput
                  placeholder="Izoh (ixtiyoriy)"
                  value={note}
                  onChangeText={setNote}
                />

                {order.isError ? (
                  <Text style={[sans(500, 11.5, 1.4), { color: theme.signal }]}>
                    {orderErrorText(order.error)}
                  </Text>
                ) : null}

                <GoldButton
                  label={order.isPending ? 'Yuborilmoqda…' : 'Buyurtma berish'}
                  onPress={
                    name.trim() && phone.trim() && !order.isPending
                      ? () => order.mutate()
                      : undefined
                  }
                  sweep={false}
                />
              </>
            )}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

function FieldInput(props: {
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
}) {
  const { theme } = useTheme();
  return (
    <TextInput
      {...props}
      placeholderTextColor={theme.off}
      style={[
        sans(500, 13),
        {
          height: 46,
          borderRadius: 12,
          paddingHorizontal: 14,
          color: theme.ink,
          backgroundColor: theme.c2,
          borderWidth: 1,
          borderColor: theme.hairline,
        },
      ]}
    />
  );
}

function orderErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'orders_disabled') return 'Bu biznes hozircha buyurtma qabul qilmayapti.';
    if (error.code === 'required_fields') return 'Ism va telefon raqamini to’g’ri kiriting.';
    if (error.code === 'too_many_requests') return 'Juda ko’p urinish. Birozdan keyin qayta urining.';
  }
  return 'Buyurtmani yuborib bo’lmadi. Qayta urinib ko’ring.';
}
