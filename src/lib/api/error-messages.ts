import {
  AUTH_ERROR_CODES as AUTH,
  COMMON_ERROR_CODES as COMMON,
  MEDIA_ERROR_CODES as MEDIA,
  MEDIA_MIN_DIMENSION,
  MENU_ERROR_CODES as MENU,
  MENU_LIMITS,
  RESTAURANT_ERROR_CODES as RESTAURANT,
} from '@bilhanah/contracts';
import { ApiError, CLIENT_ERROR_CODES as CLIENT } from './api-error';

type Text = (ar: string, en: string) => string;

const MESSAGES: Record<string, [ar: string, en: string]> = {
  [AUTH.INVALID_CREDENTIALS]: ['الإيميل أو كلمة السر مش صح.', 'The email or password is incorrect.'],
  [AUTH.EMAIL_NOT_VERIFIED]: ['لازم تأكد إيميلك الأول. افتح الرسالة اللي بعتناها لك.', 'Please confirm your email first. Open the message we sent you.'],
  [AUTH.ACCOUNT_SUSPENDED]: ['الحساب ده موقوف. تواصل مع دعم بالهنا.', 'This account is suspended. Please contact Bilhanah support.'],
  [AUTH.INVALID_TOKEN]: ['اللينك ده انتهى أو اتستخدم قبل كده.', 'This link has expired or was already used.'],
  [AUTH.SESSION_INVALID]: ['انتهت جلستك. سجّل دخولك تاني.', 'Your session has ended. Please sign in again.'],
  [AUTH.UNAUTHENTICATED]: ['سجّل دخولك عشان تكمل.', 'Please sign in to continue.'],
  [AUTH.ORIGIN_NOT_ALLOWED]: ['الطلب ده لازم يتعمل من لوحة تحكم بالهنا.', 'This request must come from the Bilhanah dashboard.'],
  [CLIENT.SESSION_EXPIRED]: ['انتهت جلستك. سجّل دخولك تاني.', 'Your session has ended. Please sign in again.'],
  [CLIENT.NETWORK_ERROR]: ['مش قادرين نوصل للسيرفر. اتأكد من الإنترنت وجرّب تاني.', 'We could not reach the server. Check your connection and try again.'],
  [COMMON.VALIDATION_FAILED]: ['في بيانات محتاجة تتراجع.', 'Some fields need your attention.'],
  [COMMON.FORBIDDEN]: ['مش مسموح لك تعمل ده.', 'You are not allowed to do that.'],
  [COMMON.NOT_FOUND]: ['مش لاقيين اللي بتدور عليه.', 'We could not find that.'],
  [COMMON.PAYLOAD_TOO_LARGE]: ['الملف أكبر من ٥ ميجا.', 'The file is larger than 5 MB.'],
  [COMMON.INTERNAL_SERVER_ERROR]: ['حصلت مشكلة عندنا. جرّب تاني بعد شوية.', 'Something went wrong on our side. Please try again shortly.'],
  [RESTAURANT.RESTAURANT_NOT_FOUND]: ['مفيش مطعم على الحساب ده لسه.', 'There is no restaurant on this account yet.'],
  [RESTAURANT.RESTAURANT_ALREADY_EXISTS]: ['الحساب ده عنده مطعم بالفعل.', 'This account already has a restaurant.'],
  [RESTAURANT.RESTAURANT_SUSPENDED]: ['المطعم موقوف حاليًا. تواصل مع دعم بالهنا.', 'This restaurant is suspended. Please contact Bilhanah support.'],
  [RESTAURANT.SUBDOMAIN_TAKEN]: ['العنوان ده اتحجز. اختار عنوان تاني.', 'That address is taken. Please choose another.'],
  [MEDIA.UNSUPPORTED_IMAGE]: ['ارفع صورة JPEG أو PNG أو WebP.', 'Upload a JPEG, PNG or WebP image.'],
  [MEDIA.IMAGE_TOO_SMALL]: [`الصورة صغيرة. استخدم صورة ${MEDIA_MIN_DIMENSION} بكسل على الأقل طول وعرض.`, `The image is too small. Use one at least ${MEDIA_MIN_DIMENSION} pixels wide and tall.`],
  [MEDIA.MEDIA_NOT_FOUND]: ['الصورة مش موجودة. ارفعها تاني.', 'The image was not found. Please upload it again.'],
  [MENU.CATEGORY_NOT_FOUND]: ['القسم ده اتمسح أو مش موجود.', 'That category no longer exists.'],
  [MENU.ITEM_NOT_FOUND]: ['الصنف ده اتمسح أو مش موجود.', 'That item no longer exists.'],
  [MENU.MENU_LIMIT_REACHED]: [`وصلت للحد الأقصى (${MENU_LIMITS.categories} قسم، ${MENU_LIMITS.items} صنف).`, `You reached the limit (${MENU_LIMITS.categories} categories, ${MENU_LIMITS.items} items).`],
  [MENU.ORDER_MISMATCH]: ['المنيو اتغير من مكان تاني. حدّثنا الترتيب، جرّب تاني.', 'The menu changed elsewhere. We refreshed it; please try again.'],
};

/** A translated, human message for any error thrown by the API client. */
export function errorMessage(error: unknown, text: Text): string {
  if (error instanceof ApiError) {
    if (error.code === COMMON.RATE_LIMITED) {
      const minutes = Math.max(1, Math.ceil((error.retryAfterSeconds ?? 60) / 60));
      const arabic = new Intl.NumberFormat('ar-EG').format(minutes);
      return text(`محاولات كتير. جرّب تاني بعد ${arabic} دقيقة.`, `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
    }
    const message = MESSAGES[error.code];
    if (message) return text(...message);
  }
  return text('حصلت مشكلة غير متوقعة. جرّب تاني.', 'Something unexpected happened. Please try again.');
}
