import Script from 'next/script';
import { RequestForm } from './request-form';

export const metadata = { title: 'ស្នើសុំបន្ទប់ប្រជុំ' };

export default function RequestPage() {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <RequestForm />
    </>
  );
}
