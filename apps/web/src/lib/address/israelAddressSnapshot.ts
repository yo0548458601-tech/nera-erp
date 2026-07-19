import { type LocalitySuggestion, type StreetSuggestion } from '@nera/entity-engine';

/**
 * Development snapshot for IsraelGovernmentAddressProvider.
 *
 * SOURCE: compiled from general public knowledge of Israeli locality and
 * street names for this sprint's development environment - this is NOT a
 * verified, machine-downloaded copy of data.gov.il's official "Localities"
 * ("יישובים") or "Streets" ("רחובות") datasets. `officialCode` is left
 * unset throughout: this snapshot does not assert any specific government
 * locality/street code, since those were not mechanically verified against
 * the live registry for this sprint. Populating real official codes, and
 * replacing this file's contents with an actual synchronized download, is
 * exactly the job described in the P007.5 report's "dataset storage and
 * synchronization architecture" section - this file is the placeholder
 * that job is meant to eventually replace or refresh.
 *
 * SNAPSHOT DATE: 2026-07 (documented here per the requirement to state a
 * snapshot date - this is the date this file was authored, not a real
 * sync timestamp from any live dataset).
 *
 * SIZE: deliberately kept moderate (dozens, not tens of thousands, of
 * localities; streets for a subset of larger localities only) so this
 * stays a lightweight development snapshot rather than a large raw
 * dataset file bundled into the browser client.
 */
export const ISRAEL_ADDRESS_SNAPSHOT_SOURCE =
  'תמונת פיתוח מקומית - טרם סונכרנה מול מאגר רשמי (data.gov.il)';
export const ISRAEL_ADDRESS_SNAPSHOT_DATE = '2026-07-01';

export const israelLocalitiesSnapshot: LocalitySuggestion[] = [
  { id: 'il-jerusalem', name: 'ירושלים', country: 'ישראל' },
  { id: 'il-tel-aviv', name: 'תל אביב-יפו', country: 'ישראל' },
  { id: 'il-haifa', name: 'חיפה', country: 'ישראל' },
  { id: 'il-rishon-lezion', name: 'ראשון לציון', country: 'ישראל' },
  { id: 'il-petah-tikva', name: 'פתח תקווה', country: 'ישראל' },
  { id: 'il-ashdod', name: 'אשדוד', country: 'ישראל' },
  { id: 'il-netanya', name: 'נתניה', country: 'ישראל' },
  { id: 'il-beer-sheva', name: 'באר שבע', country: 'ישראל' },
  { id: 'il-bnei-brak', name: 'בני ברק', country: 'ישראל' },
  { id: 'il-holon', name: 'חולון', country: 'ישראל' },
  { id: 'il-ramat-gan', name: 'רמת גן', country: 'ישראל' },
  { id: 'il-ashkelon', name: 'אשקלון', country: 'ישראל' },
  { id: 'il-rehovot', name: 'רחובות', country: 'ישראל' },
  { id: 'il-bat-yam', name: 'בת ים', country: 'ישראל' },
  { id: 'il-beit-shemesh', name: 'בית שמש', country: 'ישראל' },
  { id: 'il-kfar-saba', name: 'כפר סבא', country: 'ישראל' },
  { id: 'il-herzliya', name: 'הרצליה', country: 'ישראל' },
  { id: 'il-hadera', name: 'חדרה', country: 'ישראל' },
  { id: 'il-modiin', name: 'מודיעין-מכבים-רעות', country: 'ישראל' },
  { id: 'il-nazareth', name: 'נצרת', country: 'ישראל' },
  { id: 'il-lod', name: 'לוד', country: 'ישראל' },
  { id: 'il-ramla', name: 'רמלה', country: 'ישראל' },
  { id: 'il-raanana', name: 'רעננה', country: 'ישראל' },
  { id: 'il-nahariya', name: 'נהריה', country: 'ישראל' },
  { id: 'il-givatayim', name: 'גבעתיים', country: 'ישראל' },
  { id: 'il-hod-hasharon', name: 'הוד השרון', country: 'ישראל' },
  { id: 'il-kiryat-ata', name: 'קריית אתא', country: 'ישראל' },
  { id: 'il-kiryat-gat', name: 'קריית גת', country: 'ישראל' },
  { id: 'il-kiryat-motzkin', name: 'קריית מוצקין', country: 'ישראל' },
  { id: 'il-kiryat-bialik', name: 'קריית ביאליק', country: 'ישראל' },
  { id: 'il-kiryat-yam', name: 'קריית ים', country: 'ישראל' },
  { id: 'il-afula', name: 'עפולה', country: 'ישראל' },
  { id: 'il-eilat', name: 'אילת', country: 'ישראל' },
  { id: 'il-dimona', name: 'דימונה', country: 'ישראל' },
  { id: 'il-tiberias', name: 'טבריה', country: 'ישראל' },
  { id: 'il-safed', name: 'צפת', country: 'ישראל' },
  { id: 'il-akko', name: 'עכו', country: 'ישראל' },
  { id: 'il-elad', name: 'אלעד', country: 'ישראל' },
  { id: 'il-beitar-illit', name: 'ביתר עילית', country: 'ישראל' },
  { id: 'il-modiin-illit', name: 'מודיעין עילית', country: 'ישראל' },
  { id: 'il-maale-adumim', name: 'מעלה אדומים', country: 'ישראל' },
  { id: 'il-yavne', name: 'יבנה', country: 'ישראל' },
  { id: 'il-tirat-carmel', name: 'טירת כרמל', country: 'ישראל' },
  { id: 'il-migdal-haemek', name: 'מגדל העמק', country: 'ישראל' },
  { id: 'il-arad', name: 'ערד', country: 'ישראל' },
  { id: 'il-karmiel', name: 'כרמיאל', country: 'ישראל' },
];

export const israelStreetsSnapshot: StreetSuggestion[] = [
  // Jerusalem
  { id: 'il-str-jer-1', localityId: 'il-jerusalem', name: 'יפו' },
  { id: 'il-str-jer-2', localityId: 'il-jerusalem', name: 'הרב קוק' },
  { id: 'il-str-jer-3', localityId: 'il-jerusalem', name: 'מלכי ישראל' },
  { id: 'il-str-jer-4', localityId: 'il-jerusalem', name: 'עזה' },
  { id: 'il-str-jer-5', localityId: 'il-jerusalem', name: 'אגריפס' },
  { id: 'il-str-jer-6', localityId: 'il-jerusalem', name: 'בן יהודה' },
  { id: 'il-str-jer-7', localityId: 'il-jerusalem', name: 'קינג ג׳ורג׳' },
  { id: 'il-str-jer-8', localityId: 'il-jerusalem', name: 'רבי עקיבא' },
  // Tel Aviv-Yafo
  { id: 'il-str-ta-1', localityId: 'il-tel-aviv', name: 'הרצל' },
  { id: 'il-str-ta-2', localityId: 'il-tel-aviv', name: 'דיזנגוף' },
  { id: 'il-str-ta-3', localityId: 'il-tel-aviv', name: 'אבן גבירול' },
  { id: 'il-str-ta-4', localityId: 'il-tel-aviv', name: 'אלנבי' },
  { id: 'il-str-ta-5', localityId: 'il-tel-aviv', name: 'רוטשילד' },
  { id: 'il-str-ta-6', localityId: 'il-tel-aviv', name: 'קינג ג׳ורג׳' },
  // Haifa
  { id: 'il-str-haifa-1', localityId: 'il-haifa', name: 'הנביאים' },
  { id: 'il-str-haifa-2', localityId: 'il-haifa', name: 'העצמאות' },
  { id: 'il-str-haifa-3', localityId: 'il-haifa', name: 'הרצל' },
  { id: 'il-str-haifa-4', localityId: 'il-haifa', name: 'מוריה' },
  // Bnei Brak
  { id: 'il-str-bb-1', localityId: 'il-bnei-brak', name: 'רבי עקיבא' },
  { id: 'il-str-bb-2', localityId: 'il-bnei-brak', name: 'ז׳בוטינסקי' },
  { id: 'il-str-bb-3', localityId: 'il-bnei-brak', name: 'חזון איש' },
  // Beer Sheva
  { id: 'il-str-bs-1', localityId: 'il-beer-sheva', name: 'רגר' },
  { id: 'il-str-bs-2', localityId: 'il-beer-sheva', name: 'הפלמ״ח' },
  { id: 'il-str-bs-3', localityId: 'il-beer-sheva', name: 'קק״ל' },
  // Netanya
  { id: 'il-str-net-1', localityId: 'il-netanya', name: 'הרצל' },
  { id: 'il-str-net-2', localityId: 'il-netanya', name: 'ויצמן' },
  { id: 'il-str-net-3', localityId: 'il-netanya', name: 'שדרות בן גוריון' },
  // Raanana
  { id: 'il-str-raa-1', localityId: 'il-raanana', name: 'אחוזה' },
  { id: 'il-str-raa-2', localityId: 'il-raanana', name: 'ויצמן' },
  // Rishon LeZion
  { id: 'il-str-rl-1', localityId: 'il-rishon-lezion', name: 'רוטשילד' },
  { id: 'il-str-rl-2', localityId: 'il-rishon-lezion', name: 'הרצל' },
  // Petah Tikva
  { id: 'il-str-pt-1', localityId: 'il-petah-tikva', name: 'רוטשילד' },
  { id: 'il-str-pt-2', localityId: 'il-petah-tikva', name: 'העצמאות' },
  // Ashdod
  { id: 'il-str-ash-1', localityId: 'il-ashdod', name: 'הא׳' },
  { id: 'il-str-ash-2', localityId: 'il-ashdod', name: 'רוגוזין' },
  // Beitar Illit
  { id: 'il-str-bi-1', localityId: 'il-beitar-illit', name: 'חזון איש' },
  { id: 'il-str-bi-2', localityId: 'il-beitar-illit', name: 'עמוס' },
  // Modiin Illit
  { id: 'il-str-mi-1', localityId: 'il-modiin-illit', name: 'רבי עקיבא' },
  { id: 'il-str-mi-2', localityId: 'il-modiin-illit', name: 'חזון איש' },
  { id: 'il-str-mi-3', localityId: 'il-modiin-illit', name: 'כנפי נשרים' },
];
