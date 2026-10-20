# בית

אפליקציית דפדפן (PWA) לניהול משק בית של זוג. הממשק בעברית, מימין לשמאל.

## מפתחות

1. העתיקו `.env.example` אל `.env.local`.
2. מלאו `NEXT_PUBLIC_SUPABASE_URL` ו-`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (מפתח `sb_publishable_…`) ממסך ה-API של הפרויקט ב-Supabase. `SUPABASE_SECRET_KEY` נשאר בשרת בלבד.
3. אופציונלי לקול: `OPENAI_API_KEY` בצד השרת בלבד. בלי המפתח מוצגת הודעה בעברית, וכרטיס הטיוטה נשאר לעריכה ידנית.
4. ב-SQL Editor הריצו את `supabase/migrations/001_hms_schema.sql`.
5. צרו שני משתמשים דרך מסך הכניסה, ואז שייכו אותם ידנית (המדיניות חוסמת יצירת בית לפני שיש חבר):

```sql
insert into public.hms_households (name) values ('בית') returning id;

insert into public.hms_members (household_id, user_id, display_name) values
  ('<household-uuid>', '<user-uuid-1>', 'שם'),
  ('<household-uuid>', '<user-uuid-2>', 'שם');
```

מזהה המשתמש מוצג באפליקציה אחרי הכניסה, אם עדיין אין שיוך.

## הרצה

```bash
npm install
npm run dev
```

באייפון: Safari, שיתוף, „הוסף למסך הבית”.
