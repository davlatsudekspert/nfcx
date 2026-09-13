import { CompanyListScreen } from '@/features/dashboard/CompanyListScreen';

/**
 * Kompaniyalar ro'yxati — endi tab EMAS (spetsifikatsiya: "Company is
 * not a tab. Managing a business is a change of identity"). Tab
 * navigatordan tashqarida, `p/[code]`/`c/[companyId]` bilan bir xil
 * qatlamda: pastki navigatsiya ko'rinmaydi. Profile Switcher'dagi
 * "Barcha kompaniyalarim" havolasi shu yerga olib keladi; har bir
 * yozuv esa mavjud `/dashboard/[companyId]` ga.
 */
export default CompanyListScreen;
