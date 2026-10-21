// ─────────────────────────────────────────────────────────────
//  נתוני המשימה — כל הטקסטים והנקודות של האתר נמצאים בקובץ הזה.
//  נקודות: מתוך "טבלה של נקודות תת ימיות בחוף של הIUI".
//  כדי להוסיף תמונות: שימו קבצים בתיקייה assets/photos
//  והוסיפו אותם למערך photos של הנקודה, למשל:
//  photos: [{ src: 'assets/photos/nursery-1.jpg', caption: 'המשתלה ממערב' }]
//  (לכל תמונה צריך גם גרסה קטנה עם הסיומת ‎-s, למשל nursery-1-s.jpg)
//  model: סוג המודל התלת־ממדי (ראו js/models.js)
// ─────────────────────────────────────────────────────────────

// photoSet('nursery', 3) → nursery-1.jpg … nursery-3.jpg
const photoSet = (id, count) => Array.from({ length: count }, (_, i) => ({ src: `assets/photos/${id}-${i + 1}.jpg` }));

export const SITE = {
  title: 'מפת הקרקעית',
  place: 'חוף המכון הבין־אוניברסיטאי, אילת',
  slices: [3, 6, 9],
  // הגבהה אנכית של הקרקעית בתלת־ממד (1 = קנה מידה אמיתי)
  verticalExaggeration: 3,
};

export const LIVE_CAMERA_YOUTUBE_ID = '7t21fq-hh-4';

// lat / lon בפורמט מעלות + דקות עשרוניות, בדיוק כמו בטבלה.
// נקודה בלי נ.צ. מקבלת derive: { from, bearing, dist } — המיקום מחושב
// מאזימוט (מעלות) ומרחק (מטרים) מנקודה ידועה, ומסומן באתר כ"משוער".
export const POINTS = [
  {
    id: 'nursery', name: 'משתלה',
    lat: [29, 30.137], lon: [34, 55.103],
    depth: [7, 10], dims: [7.3, 6, 1.4], shape: 'box',
    terrain: 'אבנים קטנות ודרדרת', material: '',
    photos: photoSet('nursery', 28), model: 'nursery',
  },
  {
    id: 'tables3', name: '3 שולחנות',
    lat: [29, 30.126], lon: [34, 55.099],
    depth: [8, 10], dims: [0.8, 1.7, 1.2], shape: 'box', spacing: 5.5,
    dimsText: 'שלושה שולחנות רשת, כל אחד ברוחב 0.8, אורך 1.7 וגובה 1.2 מ׳, במרחק 5.5 מ׳ זה מזה',
    terrain: 'חצץ', material: 'מתכת',
    photos: photoSet('tables3', 9), model: 'tables3',
  },
  {
    id: 'empty', name: 'שולחן ריק',
    derive: { from: 'flowering', bearing: 60, dist: 6 },
    depth: [9, 11], dims: [1.5, 1.5, 1.5], shape: 'box',
    terrain: 'דרדרת וחצץ', material: 'מתכת',
    photos: photoSet('empty', 3), model: 'empty',
  },
  {
    id: 'flowering', name: 'שולחן פורח',
    lat: [29, 30.113], lon: [34, 55.080],
    depth: [5.6], dims: [0.8, 2.4, 0.6], shape: 'box',
    terrain: 'חול', material: 'מתכת, מכוסה אלמוגים',
    photos: photoSet('flowering', 7), model: 'flowering',
  },
  {
    id: 'current', name: 'בטונדה מד־זרם',
    lat: [29, 30.121], lon: [34, 55.083],
    depth: [4.2], dims: [1, 1.1, 2.8], shape: 'box',
    terrain: 'חול', material: 'בטון',
    photos: photoSet('current', 2), model: 'current',
  },
  {
    id: 'pair', name: 'זוג בטונדות',
    lat: [29, 30.114], lon: [34, 55.079],
    depth: [5], dims: [0.6, 2.3, 1], shape: 'box',
    terrain: 'סלעים', material: 'בטון',
    photos: photoSet('pair', 3), model: 'pair',
  },
  {
    id: 'pier', name: 'מזח',
    lat: [29, 30.110], lon: [34, 55.063],
    depth: [4], dims: [9], dimsText: 'רוחב 9 מ׳', shape: 'pier',
    terrain: 'סלעים', material: 'פלדה ובטון',
    note: 'המודל של המזח נבנה לפי תמונת הלוויין ולפי התמונות מעל ומתחת למים: עמודי סריג מפלדה, ראש מזח עם צמיגים ומעקה, ותורן מטאורולוגי.',
    photos: photoSet('pier', 8),
  },
  {
    id: 'habitat', name: 'הביטט',
    lat: [29, 30.069], lon: [34, 55.039],
    depth: [10, 11], dims: [7.8, 5.2, 2], shape: 'box',
    terrain: 'שונית, דרדרת', material: '',
    photos: photoSet('habitat', 7), model: 'habitat',
  },
  {
    id: 'habitat2', name: 'הביטט 2',
    derive: { from: 'habitat', bearing: 90, dist: 15 },
    depth: [], dims: [], shape: 'none',
    terrain: '', material: '',
    note: 'נקודה נוספת כ־15 מטר מההביטט, לכיוון המים העמוקים. עומק ומידות עדיין לא נמדדו.',
    photos: [],
  },
  {
    id: 'pyramid', name: 'פירמידה',
    lat: [29, 30.057], lon: [34, 55.025],
    depth: [8], dims: [1.6, 1.6, 1], dimsText: 'בסיס משולש בצלע 1.6, גובה 1', shape: 'pyramid',
    terrain: 'שונית, דרדרת', material: '',
    photos: photoSet('pyramid', 3), model: 'pyramid',
  },
  {
    id: 'deep', name: 'שולחן עומק',
    derive: { from: 'empty', bearing: 130, dist: 10 },
    depth: [10, 12], dims: [3, 1.5, 1], shape: 'box',
    terrain: 'דרדרת', material: '',
    photos: [], model: 'table',
  },
  {
    id: 'shahar', name: 'השולחן של שחר',
    derive: { from: 'flowering', bearing: 130, dist: 13 },
    depth: [10, 12], dims: [6, 1, 1.5], shape: 'box',
    terrain: 'דרדרת', material: '',
    photos: [], model: 'table',
  },
  {
    id: 'cylinder', name: 'גליל ליד המזח',
    derive: { from: 'pier', bearing: 180, dist: 30, rough: true },
    depth: [4], dims: [0.5, 1, 0.5], shape: 'cylinder',
    terrain: 'סלעים', material: '',
    note: '30 מטר מימין לקצה המזח.',
    photos: [], model: 'cylinder',
  },
  {
    id: 'leftblock', name: 'בטונדה משמאל למזח',
    derive: { from: 'pier', bearing: 180, dist: 10 },
    depth: [3], dims: [1, 1, 1], shape: 'box',
    terrain: 'סלעים וחול', material: 'בטון',
    note: 'כ־10 מטר דרומית לנקודת המזח.',
    photos: [], model: 'cube',
  },
  {
    id: 'camera', name: 'מצלמה',
    lat: [29, 30.077], lon: [34, 55.027],
    depth: [4], dims: [], shape: 'camera',
    terrain: 'שונית', material: '',
    live: true,
    note: 'מצלמה תת־ימית ששידורה פתוח לציבור.',
    photos: [],
  },
];

// המסלול הראשי — סדר הצלילה, כולל אזימוט ומרחק כפי שנרשמו בטבלה.
export const ROUTE = [
  { from: 'nursery', to: 'tables3', bearing: 180, dist: '24–33' },
  { from: 'tables3', to: 'flowering', bearing: 240, dist: '22' },
  { from: 'flowering', to: 'current', bearing: 0, dist: '6' },
  { from: 'current', to: 'pair', bearing: 210, dist: '22' },
  { from: 'pair', to: 'pier', bearing: 240, dist: '28' },
  { from: 'pier', to: 'habitat', bearing: 240, dist: '30' },
  { from: 'habitat', to: 'pyramid', bearing: 210, dist: '70' },
];

// הסתעפויות מהמסלול הראשי לנקודות צד
export const BRANCHES = [
  { from: 'empty', to: 'flowering', bearing: 240, dist: '6' },
  { from: 'empty', to: 'deep', bearing: 130, dist: '10' },
  { from: 'flowering', to: 'shahar', bearing: 130, dist: '13' },
  { from: 'pier', to: 'cylinder', bearing: null, dist: '30' },
  { from: 'pier', to: 'leftblock', bearing: null, dist: '10' },
  { from: 'habitat', to: 'habitat2', bearing: 90, dist: '15' },
  { from: 'pyramid', to: 'camera', bearing: null, dist: '40' },
  { from: 'camera', to: 'pier', bearing: 40, dist: '' },
];

// ─────────────────────────────────────────────────────────────
//  שקופיות. החליפו את [שם] בשמות חברי הצוות.
//  type: 'text' | 'people' | 'route' | 'profile' | 'bands' | 'facts'
// ─────────────────────────────────────────────────────────────
export const DECKS = {
  divers: {
    title: 'צוות הצלילה',
    slides: [
      {
        type: 'facts',
        image: 'assets/photos/divers-1.jpg',
        title: 'מה עשה צוות הצלילה',
        body: 'צוות הצלילה עבר מתחת למים לאורך המסלול, מהמשתלה ועד הפירמידה. בכל נקודה רשמנו את העומק, מדדנו את העצם ואת סוג הקרקעית, ולקחנו אזימוט ומרחק אל הנקודה הבאה. מהרישומים האלה נבנתה המפה.',
      },
      {
        type: 'people',
        title: 'חברי הצוות',
        people: [
          { name: '[שם]', role: 'ניווט ומצפן' },
          { name: '[שם]', role: 'מדידת עצמים' },
          { name: '[שם]', role: 'צילום' },
          { name: '[שם]', role: 'רישום על לוח' },
        ],
      },
      {
        type: 'text',
        title: 'איך מדדנו',
        list: [
          ['עומק', 'לפי מחשב הצלילה, בתחתית העצם.'],
          ['מידות', 'סרט מדידה: רוחב, אורך וגובה.'],
          ['כיוון', 'מצפן, אזימוט מכל נקודה לבאה אחריה.'],
          ['מרחק', 'סרט מדידה בין הנקודות.'],
          ['קרקעית', 'תיאור חזותי: חול, חצץ, דרדרת, סלעים או שונית.'],
        ],
      },
    ],
  },
  snorkel: {
    title: 'צוות המשקיפים',
    slides: [
      {
        type: 'text',
        title: 'מה עשה צוות המשקיפים',
        body: 'צוות השנורקל והצלילה החופשית ליווה את הצוללים מפני המים. המשקיפים סימנו את הנקודות במצופים, רשמו נקודת ציון מעל כל עצם ושמרו על קשר עין עם הצוללים לאורך כל המסלול.',
      },
      {
        type: 'people',
        title: 'חברי הצוות',
        people: [
          { name: '[שם]', role: 'תצפית ובטיחות' },
          { name: '[שם]', role: 'סימון במצופים' },
          { name: '[שם]', role: 'רישום נקודות ציון' },
        ],
      },
    ],
  },
  plan: {
    title: 'תכנון המשימה',
    slides: [
      {
        type: 'text',
        title: 'מטרת המשימה',
        body: 'למפות את העצמים שמתחת למים בחוף המכון הבין־אוניברסיטאי באילת, ולהציג את הקרקעית בשלושה חתכי עומק: 3, 6 ו־9 מטר.',
      },
      { type: 'image', title: 'האתר מלמעלה', image: 'assets/photos/satellite-1.jpg', caption: 'תמונת לוויין של חוף המכון והמזח. מקור: GovMap.' },
      { type: 'route', title: 'המסלול' },
      { type: 'profile', title: 'חתך עומק לאורך המסלול' },
      { type: 'bands', title: 'הנקודות לפי עומק' },
    ],
  },
};
