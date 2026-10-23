import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { registerOwnerSchema } from '@bilhanah/contracts';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { PasswordInput } from '../../components/PasswordInput';
import { authApi } from '../../lib/api/endpoints';
import { errorMessage } from '../../lib/api/error-messages';
import { schemaResolver } from '../../lib/forms';
import { useLanguage, usePageTitle } from '../../lib/language';
import { AuthCard } from './AuthCard';

export function RegisterPage() {
  const { text, language, chooseLanguage } = useLanguage();
  usePageTitle('إنشاء حساب', 'Create your account');
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);
  const { register, handleSubmit, setValue, getFieldState, formState: { errors, isSubmitting } } = useForm({
    resolver: schemaResolver(registerOwnerSchema),
    defaultValues: { fullName: '', email: '', password: '', preferredLanguage: language },
  });

  // Until the owner picks one, the account language follows the page language.
  useEffect(() => {
    if (!getFieldState('preferredLanguage').isDirty) setValue('preferredLanguage', language);
  }, [language, getFieldState, setValue]);

  const onSubmit = handleSubmit(async values => {
    setError(null);
    try {
      await authApi.register(values);
      chooseLanguage(values.preferredLanguage);
      navigate('/check-email', { state: { email: values.email } });
    } catch (caught) {
      setError(caught);
    }
  });

  return <AuthCard title={text('ابدأ تجربتك المجانية', 'Start your free trial')} description={text('٣٠ يوم مجانًا على التجربة الكاملة، من غير بطاقة ومن غير تجديد تلقائي.', '30 days free on the Full Experience. No card, no automatic renewal.')}>
    {error !== null && <Alert kind="error">{errorMessage(error, text)}</Alert>}
    <form className="form" onSubmit={onSubmit} noValidate>
      <Field label={text('اسمك', 'Your name')} error={errors.fullName} required>
        <input className="input" autoComplete="name" {...register('fullName')} />
      </Field>
      <Field label={text('الإيميل', 'Email')} error={errors.email} required hint={text('هنبعت لك لينك تأكيد على الإيميل ده.', 'We will send a confirmation link to this address.')}>
        <input className="input" type="email" autoComplete="email" inputMode="email" dir="ltr" {...register('email')} />
      </Field>
      <Field label={text('كلمة السر', 'Password')} error={errors.password} required hint={text('٨ حروف على الأقل.', 'At least 8 characters.')}>
        <PasswordInput autoComplete="new-password" {...register('password')} />
      </Field>
      <fieldset className="field">
        <legend className="field-label">{text('لغة الرسائل والحساب', 'Language for emails and your account')}</legend>
        <div className="segmented">
          <label lang="ar"><input type="radio" value="ar" {...register('preferredLanguage')} />العربية</label>
          <label lang="en"><input type="radio" value="en" {...register('preferredLanguage')} />English</label>
        </div>
      </fieldset>
      <Button type="submit" block loading={isSubmitting}>{text('إنشاء الحساب', 'Create account')}</Button>
    </form>
    <p className="auth-alt">{text('عندك حساب بالفعل؟', 'Already have an account?')} <Link className="link" to="/login">{text('سجّل دخولك', 'Sign in')}</Link></p>
  </AuthCard>;
}
