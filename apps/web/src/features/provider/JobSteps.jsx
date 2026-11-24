import React from 'react';
import { useT } from '../../shared/ui.jsx';
import '../../styles/steps.css';

// Dialoo Partner job journey: 5 clear steps + a plain-language "what to do now" box on every job card.
const ORDER = ['REQUESTED', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED'];

export default function JobSteps({ status, paid }) {
  const t = useT();
  if (!ORDER.includes(status)) return null; // rejected / expired / cancelled: no journey to show
  const cur = status === 'COMPLETED' && paid ? 5 : ORDER.indexOf(status);
  const labels = [
    t('Request', 'रिक्वेस्ट'), t('Accepted', 'स्वीकार'), t('On the way', 'रास्ते में'), t('Working', 'काम'), t('Payment', 'भुगतान'),
  ];
  const hint = {
    REQUESTED: [t('Step 1 of 5 · New request', 'स्टेप 1/5 · नई रिक्वेस्ट'), t('Press Accept to take this job. If you are not free, press Reject.', 'काम लेना हो तो ‘स्वीकार’ दबाएँ। खाली नहीं हैं तो ‘अस्वीकार’ दबाएँ।')],
    ACCEPTED: [t('Step 2 of 5 · Job accepted', 'स्टेप 2/5 · बुकिंग पक्की'), t('When you are ready to leave, press “I am on the way”. The consumer will see your live location.', 'जब निकलने को तैयार हों तो ‘मैं निकल गया’ दबाएँ। कंज़्यूमर को आपकी लाइव लोकेशन दिखेगी।')],
    ON_THE_WAY: [t('Step 3 of 5 · Reach the address', 'स्टेप 3/5 · पते पर पहुँचें'), t('After you arrive, ask the consumer for the 4-digit start code (shown in their Dialoo app), then press “Start work”.', 'पहुँचकर कंज़्यूमर से 4 अंकों का स्टार्ट कोड माँगें (उनके Dialoo ऐप में दिखता है), फिर ‘काम शुरू’ दबाएँ।')],
    IN_PROGRESS: [t('Step 4 of 5 · Work in progress', 'स्टेप 4/5 · काम चल रहा है'), t('When the work is finished, press “Complete job” and enter the final amount.', 'काम पूरा होने पर ‘काम पूरा करें’ दबाएँ और अंतिम रकम डालें।')],
    COMPLETED: paid
      ? [t('All done · Payment received', 'सब पूरा · भुगतान मिल गया'), t('Great work! This booking is complete.', 'बहुत बढ़िया! यह बुकिंग पूरी हो गई।')]
      : [t('Step 5 of 5 · Collect payment', 'स्टेप 5/5 · भुगतान लें'), t('Take the payment from the consumer, then press “Mark paid”.', 'कंज़्यूमर से भुगतान लेकर ‘भुगतान मिला’ दबाएँ।')],
  }[status];

  return (
    <>
      <ol className="steps" aria-label={t('Job progress', 'काम की प्रगति')}>
        {labels.map((l, i) => (
          <li key={l} className={i < cur ? 'done' : i === cur ? 'now' : ''} aria-current={i === cur ? 'step' : undefined}>
            <span>{i < cur ? '✓' : i + 1}</span><em>{l}</em>
          </li>
        ))}
      </ol>
      <div className={`next-step ${cur === 5 ? 'finished' : ''}`} role="note"><b>{hint[0]}</b>{hint[1]}</div>
    </>
  );
}
