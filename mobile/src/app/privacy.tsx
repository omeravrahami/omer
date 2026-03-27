import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

const BG_DEEP = '#080E1A';
const BG_CARD = '#0F1729';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.55)';
const ACCENT_BLUE = '#3B82F6';

const sections = [
  {
    title: 'מה אנחנו אוספים',
    body: 'האפליקציה שומרת את נתוני שעות העבודה, ההפסקות, ושיעור השכר שלך. הנתונים מאוחסנים במכשיר שלך ובשרת מאובטח, ומקושרים לחשבון המשתמש האישי שלך.',
  },
  {
    title: 'איך אנחנו משתמשים במידע',
    body: 'המידע משמש אך ורק להצגת נתוני שכר וסטטיסטיקות בתוך האפליקציה. אנחנו לא מוכרים, מעבירים, או חולקים את המידע שלך עם צדדים שלישיים.',
  },
  {
    title: 'אחסון ואבטחה',
    body: 'הנתונים מוצפנים בעת העברה (HTTPS). נתוני ההגדרות נשמרים גם מקומית במכשיר באמצעות AsyncStorage מוצפן.',
  },
  {
    title: 'פרסומות',
    body: 'גרסת החינמית מציגה פרסומות דרך ספקי פרסום מורשים. ספקים אלה עשויים לאסוף מידע אנונימי כדי להציג פרסומות רלוונטיות, בהתאם למדיניות הפרטיות שלהם.',
  },
  {
    title: 'מחיקת נתונים',
    body: 'ניתן למחוק את כל הנתונים ואת החשבון בכל עת דרך הגדרות האפליקציה ← "מחיקת חשבון". ניתן גם לפנות אלינו ישירות בכתובת support@workclock.app לבקשת מחיקת הנתונים.',
  },
  {
    title: 'יצירת קשר',
    body: 'לשאלות בנושא פרטיות, ניתן לפנות אלינו במייל: support@workclock.app',
  },
];

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG_DEEP }} testID="privacy-screen">
      {/* Header */}
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontSize: 18,
            fontWeight: '700',
            color: TEXT_PRIMARY,
            textAlign: 'right',
          }}
        >
          מדיניות פרטיות
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{ padding: 8 }}
          testID="privacy-back-button"
        >
          <ChevronRight size={22} color={ACCENT_BLUE} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <View
          style={{
            backgroundColor: BG_CARD,
            borderRadius: 16,
            padding: 18,
            borderWidth: 1,
            borderColor: BORDER,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              color: TEXT_SECONDARY,
              textAlign: 'right',
              lineHeight: 20,
            }}
          >
            {'עדכון אחרון: מרץ 2026'}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: TEXT_PRIMARY,
              textAlign: 'right',
              lineHeight: 22,
              marginTop: 8,
            }}
          >
            {'WorkClock מחויבת להגנה על פרטיותך. מסמך זה מסביר אילו נתונים אנחנו אוספים, כיצד אנחנו משתמשים בהם, ואיך אנחנו שומרים עליהם.'}
          </Text>
        </View>

        {/* Sections */}
        {sections.map((s, i) => (
          <View
            key={i}
            style={{
              backgroundColor: BG_CARD,
              borderRadius: 16,
              padding: 18,
              borderWidth: 1,
              borderColor: BORDER,
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: TEXT_PRIMARY,
                textAlign: 'right',
                marginBottom: 8,
              }}
            >
              {s.title}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: TEXT_SECONDARY,
                textAlign: 'right',
                lineHeight: 20,
              }}
            >
              {s.body}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
