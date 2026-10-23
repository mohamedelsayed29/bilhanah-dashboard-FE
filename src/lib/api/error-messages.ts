import {
  ADMIN_ERROR_CODES as ADMIN,
  AUTH_ERROR_CODES as AUTH,
  BILLING_ERROR_CODES as BILLING,
  COMMON_ERROR_CODES as COMMON,
  MEDIA_ERROR_CODES as MEDIA,
  MEDIA_MIN_DIMENSION,
  MENU_ERROR_CODES as MENU,
  MENU_LIMITS,
  ORDER_ERROR_CODES as ORDER,
  ORDER_LIMITS,
  RESTAURANT_ERROR_CODES as RESTAURANT,
  SHOP_ERROR_CODES as SHOP,
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
  [BILLING.PAYMENT_ALREADY_PENDING]: ['عندك تحويل لسه بيتراجع. استنى المراجعة أو اسحبه الأول.', 'You already have a payment under review. Wait for it, or withdraw it first.'],
  [BILLING.PAYMENT_NOT_FOUND]: ['التحويل ده مش موجود.', 'That payment could not be found.'],
  [BILLING.PAYMENT_NOT_PENDING]: ['التحويل ده اتراجع خلاص.', 'This payment has already been reviewed.'],
  [BILLING.PAYMENT_METHOD_UNAVAILABLE]: ['طريقة الدفع دي مش متاحة دلوقتي. اختار طريقة تانية.', 'This payment method is not available right now. Please choose another.'],
  [BILLING.ONLINE_PAYMENT_UNAVAILABLE]: ['الدفع الأونلاين مش متاح دلوقتي. جرّب كمان شوية، أو ادفع بتحويل.', 'Online payment is not available right now. Try again shortly, or pay by transfer.'],
  [SHOP.STAND_ORDER_NOT_FOUND]: ['طلب الستاند ده مش موجود.', 'That stand order could not be found.'],
  [ADMIN.MFA_NOT_SET_UP]: ['التحقق بخطوتين مش متفعّل على الحساب ده. اطلب من المسؤول التقني يشغّل npm run admin:reset-mfa.', 'Two-step sign-in is not set up for this account. Ask an operator to run npm run admin:reset-mfa.'],
  [ADMIN.ALREADY_SUSPENDED]: ['المطعم ده موقوف بالفعل.', 'This restaurant is already suspended.'],
  [ADMIN.NOT_SUSPENDED]: ['المطعم ده مش موقوف.', 'This restaurant is not suspended.'],
  [ORDER.ORDERING_UNAVAILABLE]: ['الطلبات مش متاحة دلوقتي.', 'Ordering is not available right now.'],
  [ORDER.RESTAURANT_CLOSED]: ['المطعم مقفول دلوقتي حسب مواعيد الشغل.', 'The restaurant is closed right now (opening hours).'],
  [ORDER.ORDER_TYPE_UNAVAILABLE]: ['نوع الطلب ده مش متاح.', 'This kind of order is not available.'],
  [ORDER.TABLE_NOT_FOUND]: ['الطاولة دي مش موجودة أو اتمسحت.', 'That table no longer exists.'],
  [ORDER.ITEMS_UNAVAILABLE]: ['في أصناف في الطلب خلصت أو مش متاحة.', 'Some dishes in the order are sold out or unavailable.'],
  [ORDER.ORDER_NOT_FOUND]: ['الطلب ده مش موجود.', 'That order could not be found.'],
  [ORDER.INVALID_STATUS_CHANGE]: ['الطلب ده اتحدّث من جهاز تاني. حدّثنا اللوحة.', 'This order was updated on another device. The board has been refreshed.'],
  [ORDER.TABLE_LABEL_TAKEN]: ['في طاولة بنفس الاسم ده. اختار اسم تاني.', 'A table with this name already exists. Choose another name.'],
  [ORDER.TABLE_LIMIT_REACHED]: [`وصلت للحد الأقصى (${ORDER_LIMITS.tables} طاولة).`, `You reached the limit of ${ORDER_LIMITS.tables} tables.`],
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
