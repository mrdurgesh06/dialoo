/* Dialoo legal text. Edit here; the Terms page renders straight from this file.
   Bump TERMS_VERSION (and AuthController.TERMS_VERSION on the server) whenever the text changes in a way users must re-accept. */
export const TERMS_VERSION = '2026-11-25';
export const EFFECTIVE = '25 November 2026';
export const CONTACT = {
  owner: 'NarayaniX',
  place: 'Sahaswan, District Budaun, Uttar Pradesh, India',
  email: 'support@dialoo.in', // TODO: replace with your real support mailbox
};

/* A section body is an array of blocks: a string = paragraph, an array of strings = bullet list. */
export const TABS = {
  terms: {
    label: ['Terms of Use', 'उपयोग की शर्तें'],
    title: 'Terms of Use',
    lead: 'These terms apply to everyone who uses Dialoo: Customers who book services and Dialoo Partners who offer them.',
    hindi: [
      'Dialoo एक मार्केटप्लेस है: हम Customer और लोकल सर्विस देने वाले Partner को मिलाते हैं। सर्विस Partner खुद देता है, Dialoo नहीं।',
      'लॉगिन मोबाइल नंबर + OTP से होता है। OTP किसी को न बताएँ। 18 साल से कम उम्र के लोग अकाउंट नहीं बना सकते।',
      'एक लॉगिन एक ही तरफ़ का होता है: या तो Customer या Dialoo Partner। दोनों के लिए अलग-अलग लॉगिन चुनना होगा।',
      'दाम और भुगतान Customer और Partner के बीच तय होते हैं। काम पूरा होने पर Partner अंतिम राशि दर्ज करता है।',
      'लाइव लोकेशन सिर्फ़ बुकिंग के दौरान, आपकी अनुमति से, और Partner के काम शुरू करने तक साझा होती है।',
      'गलत इस्तेमाल, धोखाधड़ी या बदतमीज़ी पर अकाउंट रोका या बंद किया जा सकता है।',
    ],
    sections: [
      { id: 'acceptance', title: '1. About these terms', body: [
        'Dialoo (the "Platform") is a local-services marketplace for Tier-2 and Tier-3 cities of India, owned and operated by NarayaniX ("Dialoo", "we", "us"). The Platform is available as a website, a Progressive Web App and a mobile app.',
        'By logging in, creating an account, continuing as a guest, or otherwise using the Platform, you agree to these Terms of Use, the Privacy Policy and, if you are a Dialoo Partner, the Partner Terms (together, the "Terms"). If you do not agree, please do not use the Platform.',
        'The Terms are an electronic record under the Information Technology Act, 2000 and do not need a physical or digital signature.',
      ]},
      { id: 'definitions', title: '2. Key words', body: [[
        '"Customer" means a person who searches for and books services on Dialoo.',
        '"Dialoo Partner" or "Partner" means a professional, shop or business that has applied to offer services on Dialoo (also called a "provider" inside the app).',
        '"Service" means any work, repair, rental, class, delivery or other job that a Partner offers through the Platform.',
        '"Booking" means a request made by a Customer to a Partner for a Service, from the moment it is placed until it is completed, cancelled, rejected or expired.',
        '"Start Code" means the 4-digit code shown to the Customer that the Partner enters to confirm they have reached the right place and are starting the work.',
      ]]},
      { id: 'eligibility', title: '3. Eligibility and your account', body: [
        'You must be at least 18 years old and legally able to enter into a contract in India to create an account. Minors may not use the Platform on their own.',
        [
          'You log in with your mobile number and a one-time password (OTP) sent by SMS, or with a mobile number/email and a password if you have set one.',
          'One mobile number is one person. Please do not share your account, your OTP or your password with anyone. Dialoo staff will never ask you for an OTP.',
          'You are responsible for everything done through your account until you tell us it has been compromised.',
          'You must give correct information (name, mobile number, address) and keep it up to date.',
          'Guest mode lets you look at services only. To book, you must log in.',
        ],
        'One login, one side. Every login session on Dialoo is either a Customer session or a Dialoo Partner session, chosen on the login screen. A Customer session shows and can use only Customer features; a Partner session shows and can use only Partner features. The same mobile number may be used for both, but you must log in separately for each side. Dialoo may restrict or end a session that tries to use the other side\'s features.',
      ]},
      { id: 'role', title: '4. Dialoo is a marketplace', body: [
        'Dialoo is an intermediary that helps Customers find and contact Partners. Dialoo does not itself provide the Services, is not the employer, agent or principal of any Partner, and is not a party to the contract for a Service. That contract is directly between the Customer and the Partner.',
        [
          'Partners decide whether to accept a Booking, how they perform the work, and (within these Terms) what they charge.',
          'Dialoo checks some Partner details (such as mobile number and identity documents) and may show a "Verified" badge. A badge is not a guarantee of quality, skill, licence, background or behaviour.',
          'Dialoo does not guarantee that a Partner will be available, on time, or suitable for your job.',
        ],
      ]},
      { id: 'booking', title: '5. How a Booking works', body: [
        'A normal Booking moves through these stages. Each stage is recorded with a time and, where relevant, a reason.',
        [
          'Requested: the Customer places a Booking with the address, description and preferred time.',
          'Accepted or Rejected: the Partner accepts or rejects. If the Partner does not respond within the response window, the Booking expires automatically.',
          'On the way: the Partner starts travelling. The Customer can follow the live location (see section 8).',
          'In progress: the Partner enters the Customer\'s Start Code to begin. Customers should share the Start Code only when the Partner has actually arrived.',
          'Completed: the Partner enters the final amount agreed with the Customer and marks the job complete.',
          'Paid and reviewed: the Partner records the payment received and the Customer may rate the Partner.',
        ],
        'Either side can use in-app chat for the Booking. Please keep job-related talk inside the Booking so it can be used if there is a dispute.',
      ]},
      { id: 'pricing', title: '6. Prices and payments', body: [
        [
          'Prices shown on the Platform ("starting from", service prices, estimates) are guides set by Partners. The final amount is the amount the Customer and Partner agree for the actual work, which the Partner records when completing the Booking.',
          'Unless the Platform clearly says otherwise, the Customer pays the Partner directly (for example in cash or UPI) after the work is done. Dialoo does not currently collect or hold your money for a Service.',
          'If Dialoo introduces online payment, wallet, deposit or refund features, extra terms will be shown before you use them.',
          'A Partner must not ask for more than the agreed final amount, and a Customer must pay what was agreed for work that was done. Disagreements should first be solved between you; you may then contact Dialoo support.',
          'Coupons and offers are subject to their own conditions, may be changed or withdrawn, and cannot be exchanged for cash.',
          'Taxes such as GST, where applicable, are the responsibility of the Partner for Services and of Dialoo for fees Dialoo charges.',
        ],
      ]},
      { id: 'cancel', title: '7. Cancellation, rejection and no-shows', body: [
        [
          'A Customer may cancel a Booking before work starts. Please cancel as early as you can so the Partner can plan their day.',
          'A Partner may reject a Booking or, with a reason, cancel one already accepted. Repeated last-minute cancellations, no-shows or unreasonable rejections can lower a Partner\'s ranking or lead to suspension.',
          'If a Partner reaches the address and the Customer is unreachable or refuses the agreed work without a good reason, the Partner may ask Dialoo to review whether a reasonable visit charge is due.',
          'Dialoo may cancel a Booking if it looks fraudulent, unsafe or in breach of these Terms.',
        ],
      ]},
      { id: 'location', title: '8. Location and live tracking', body: [
        [
          'With your permission, the Platform uses your device location to suggest your city, show nearby Partners and help Partners find your address. You can turn permission off in your phone or browser settings at any time, though some features may stop working.',
          'When a Partner marks "On the way", the Partner\'s live location is shared with that Customer for that Booking only, and sharing stops when the work starts or the Booking ends.',
          'Customers should give a correct service address. Partners may save a shop or work location to help Customers find them.',
        ],
        'Location data is handled as described in the Privacy Policy.',
      ]},
      { id: 'comms', title: '9. Chat, calls and messages', body: [
        'Dialoo may send you OTPs, booking updates and service messages by SMS, push or in-app notification. These are necessary to run the Booking and cannot be turned off while you have an active Booking. Promotional messages, if any, will be sent only where the law allows and you may opt out.',
        'Phone numbers of the other side are shown only after a Booking is accepted and only for that Booking. Do not use them to spam, harass or market to the other person.',
      ]},
      { id: 'reviews', title: '10. Ratings and reviews', body: [
        [
          'Only Customers with a completed Booking can review a Partner. Reviews must be honest, based on your own experience, and free of abuse, hate, personal data or false claims.',
          'Partners may publicly reply to reviews about them. Partners must not pay for, trade or pressure Customers for reviews.',
          'Dialoo may remove or hide reviews that break these Terms. Dialoo does not edit a review to change its meaning.',
        ],
      ]},
      { id: 'safety', title: '11. Safety and emergencies', body: [
        'In any real emergency (fire, crime, medical or personal danger) call 112 or the relevant emergency service first. The "Emergency help" feature on Dialoo is a request channel to nearby Partners and Dialoo support; it is not a replacement for emergency services and Dialoo cannot promise a response time.',
        'Please use common sense when letting someone into your home or workplace. Share the Start Code only on arrival, and tell us straight away if anyone behaves unsafely.',
      ]},
      { id: 'conduct', title: '12. What you must not do', body: [[
        'Break any law or use the Platform for anything illegal, harmful, fraudulent or misleading.',
        'Create fake accounts, fake Bookings, fake reviews or impersonate any person or business.',
        'Harass, threaten, abuse, discriminate against or endanger Customers, Partners or Dialoo staff.',
        'Offer or request services that are illegal or unsafe, including prohibited goods, weapons, drugs, adult services or any service forbidden for the category.',
        'Collect other users\' data, scrape the Platform, probe or interfere with its security, or reverse-engineer it.',
        'Use the Platform to avoid paying fees that are due, or to misuse Start Codes, coupons or any offer.',
        'Upload viruses, spam, or content you do not have the right to share.',
      ]]},
      { id: 'ip', title: '13. Dialoo\'s property and your content', body: [
        'The Dialoo name, logo, app design, software and content (other than what users submit) belong to NarayaniX or its licensors. You may use the Platform only as these Terms allow and may not copy or sell any part of it.',
        'You keep ownership of what you submit (photos, descriptions, reviews, messages). You give Dialoo a free, non-exclusive, worldwide licence to host, display and use that content to run, promote and improve the Platform. You confirm you have the right to give this licence.',
      ]},
      { id: 'suspension', title: '14. Suspension and ending your account', body: [
        [
          'You may stop using Dialoo at any time. To delete your account and data, contact us (see section 21). Open Bookings should be completed or cancelled first.',
          'Dialoo may warn, restrict, suspend or end an account, remove content or cancel Bookings if we reasonably believe these Terms or the law have been broken, if there is a safety or fraud risk, or if required by authorities.',
          'Sections that by their nature should continue after an account ends (for example payment, liability, privacy and disputes) will continue.',
        ],
      ]},
      { id: 'disclaimer', title: '15. Disclaimers', body: [
        'The Platform is provided "as is" and "as available". To the fullest extent the law allows, Dialoo does not promise that it will be uninterrupted, error-free or always available, that Partners will be available or suitable, or that any Service will meet your expectations.',
        'Information about Partners (descriptions, prices, experience, availability, location) is supplied by Partners. Please check what matters to you before you book.',
      ]},
      { id: 'liability', title: '16. Limits on our liability', body: [
        'Because Services are provided by independent Partners, Dialoo is not responsible for the quality, safety, legality, timing or price of any Service, or for any damage, injury, loss or dispute between a Customer and a Partner, except where the law says we cannot exclude such responsibility.',
        'Subject to the law, Dialoo is not liable for indirect, incidental or consequential loss (such as lost profit or lost opportunity). Where Dialoo is found liable to you for any reason, its total liability will not be more than the fees you paid to Dialoo in the 6 months before the claim or ₹5,000, whichever is higher.',
        'Nothing in these Terms limits liability that cannot be limited by law, including liability for fraud or wilful misconduct.',
      ]},
      { id: 'indemnity', title: '17. Your responsibility', body: [
        'You agree to compensate Dialoo and its owners and staff for losses, claims and costs (including reasonable legal fees) arising from your breach of these Terms, your misuse of the Platform, or your violation of any law or third-party right.',
      ]},
      { id: 'grievance', title: '18. Complaints and grievances', body: [
        'If you have a problem with a Booking, a Partner, a Customer, or any content, first contact the other person through in-app chat. If it is not solved, write to us (section 21) with the Booking code. We will acknowledge complaints within 48 hours and aim to resolve them within 15 days, and we may ask both sides for details.',
        'Grievances about personal data are handled by our Grievance Officer as described in the Privacy Policy.',
      ]},
      { id: 'changes', title: '19. Changes to these Terms', body: [
        'We may update these Terms as Dialoo grows or the law changes. The date and version are shown at the top of the page. For important changes we will notify you in the app or by SMS. If you keep using Dialoo after the effective date, the updated Terms apply to you. Fee changes for Partners follow the longer notice described in the Partner Terms.',
      ]},
      { id: 'law', title: '20. Governing law and disputes', body: [
        'These Terms are governed by the laws of India. Please try to resolve any dispute with us through section 18 first. If a dispute remains, it is subject to the exclusive jurisdiction of the courts at Budaun, Uttar Pradesh, India, without limiting any consumer rights you have under law.',
      ]},
      { id: 'contact', title: '21. Contact', body: [
        `${CONTACT.owner} (owner and operator of Dialoo), ${CONTACT.place}. Email: ${CONTACT.email}.`,
      ]},
    ],
  },

  partner: {
    label: ['Partner Terms', 'पार्टनर शर्तें'],
    title: 'Dialoo Partner Terms',
    lead: 'Extra terms for professionals, shops and businesses who offer services on Dialoo. They are part of, and must be read with, the Terms of Use and Privacy Policy.',
    hindi: [
      'अभी Dialoo पार्टनर बनना और शुरुआती सुविधाएँ फ़्री हैं (फ़्री पीरियड)।',
      'फ़्री पीरियड के बाद Dialoo सब्सक्रिप्शन या दूसरी फ़ीस ले सकता है। कोई भी फ़ीस शुरू होने से कम से कम 30 दिन पहले ऐप में और SMS से बताया जाएगा।',
      'फ़्री पीरियड के लिए कोई पिछला चार्ज नहीं लगेगा। बिना आपकी हाँ के कोई पेमेंट अपने आप नहीं कटेगा। प्लान न चुनने पर आपकी लिस्टिंग रोकी जा सकती है, पर कोई जुर्माना नहीं।',
      'आप Dialoo के कर्मचारी नहीं, स्वतंत्र पार्टनर हैं। काम की क्वालिटी, टैक्स, लाइसेंस और सुरक्षा आपकी ज़िम्मेदारी है।',
      'सही जानकारी दें, बुकिंग का जल्दी जवाब दें, तय राशि से ज़्यादा न माँगें, और ग्राहक की जानकारी सिर्फ़ उसी काम के लिए इस्तेमाल करें।',
    ],
    sections: [
      { id: 'p-who', title: 'P1. Who can become a Partner', body: [
        [
          'You must be at least 18, be able to do the work you list, and hold any licence, registration or permission the law requires for it (for example electrical, food, medical, driving or vehicle permissions).',
          'A person or a business can apply. If you apply for a business you confirm you are allowed to bind it to these terms.',
          'One mobile number can be both a Customer and a Partner, but each uses a separate login session as explained in the Terms of Use.',
        ],
      ]},
      { id: 'p-apply', title: 'P2. Application, verification and approval', body: [
        'Applying does not guarantee approval. Your profile is reviewed by the Dialoo team and goes live only after approval. We may ask for identity, address, shop, experience or licence proof, and may re-verify at any time.',
        'Dialoo may approve, reject, hold or remove a profile at its discretion, for example for incomplete or false information, safety concerns, repeated complaints or categories we do not yet support. We will tell you the reason where we reasonably can.',
      ]},
      { id: 'p-fees', title: 'P3. Free launch period and future fees', body: [
        'This section is important. Please read it fully.',
        [
          'Free period. At present, applying as a Dialoo Partner, being listed after approval, receiving Booking requests and using the Partner dashboard are free of charge ("Free Period"). The features and limits available during the Free Period are those shown in the Partner app and may be adjusted from time to time.',
          'Fees will start later. Dialoo may end the Free Period and begin charging Partners, for example through a monthly or yearly subscription, a per-Booking or commission fee, or fees for optional extras such as promotion or priority listing ("Fees"). Dialoo is not obliged to keep any plan free.',
          'At least 30 days\' notice. Before any Fee applies to you, Dialoo will give you at least 30 days\' written notice by in-app notification and SMS to your registered mobile number, stating what will be charged, how much, how often, what you get, and the date it starts. Plans and prices are always shown in the Partner app under "Your plan" before they apply.',
          'Nothing for the past. No Fee will be charged for any period or Booking during the Free Period.',
          'Your choice, and no automatic charge. You may accept the paid plan, or choose not to continue and close your Partner profile without any charge. Dialoo will not deduct any money without your clear confirmation (for example selecting a plan and completing the payment). If you do not select a plan by the start date, Dialoo may pause your listing, hide it from search or limit new Booking requests until you do; this is not a penalty and your profile data is kept for a reasonable time.',
          'How you pay. Fees are paid through the payment methods shown in the app. Prices are shown with or without GST as stated; where GST applies it is added. Dialoo will issue a receipt or invoice for amounts paid.',
          'Refunds. Fees already paid are non-refundable, except where the law requires, where we charged you by mistake, or where Dialoo could not provide the paid service. Billing mistakes will be corrected.',
          'Changes later. Dialoo may change plans, prices or features at any time by giving you at least 30 days\' notice. A change applies from your next billing cycle. If you do not agree, you may stop before it applies.',
          'Late or failed payment. If a due Fee is not paid, Dialoo may send reminders and, after a grace period of 7 days, may pause or limit your listing until it is paid. Booking you have already accepted must still be completed or properly cancelled.',
        ],
        'By applying as a Partner you confirm you understand that Dialoo for Partners is free now and may become paid in future on the terms above.',
      ]},
      { id: 'p-status', title: 'P4. You are an independent Partner', body: [
        'You are an independent business or professional. You are not an employee, worker, agent, partner or joint venturer of Dialoo. Dialoo does not control how you do your work, set your hours or provide tools or training, and does not guarantee you any minimum number of Bookings or income.',
        'You are responsible for your own tools, staff, vehicle, insurance, income tax, GST (where applicable), licences and all legal duties towards anyone you employ.',
      ]},
      { id: 'p-profile', title: 'P5. Your profile, services and prices', body: [
        [
          'Everything on your profile (business name, category, photos, services, experience, address, languages, prices, availability) must be true, current and not misleading. Do not use another person\'s photos, name, licences or reviews.',
          'Keep your "Online/Offline" status honest. Go online only when you can take jobs.',
          'Prices you list should reflect what you will actually charge. Surprise charges beyond the agreed amount are not allowed.',
          'Choose the correct category and list only services you are skilled and permitted to perform.',
        ],
      ]},
      { id: 'p-jobs', title: 'P6. Handling Bookings', body: [
        [
          'Respond to requests promptly. Accept only jobs you can do at the time promised. Update the status honestly (accepted, on the way, started, completed).',
          'Use the Customer\'s Start Code only after you have reached the address. Never ask a Customer to share the code in advance or over chat to "mark" the job.',
          'Complete the work with reasonable skill and care, using safe methods and suitable materials, and tell the Customer about any extra cost before doing extra work.',
          'Record the final agreed amount correctly and mark payment only when you have really received it.',
          'If you are on the way, keep location permission on and the app open so the Customer can track you.',
        ],
      ]},
      { id: 'p-conduct', title: 'P7. Quality, behaviour and safety', body: [
        [
          'Be polite, punctual and respectful. No harassment, discrimination, intimidation, or pressure for extra payment, tips or reviews.',
          'Carry proper ID. Do not attend while intoxicated. Do not bring anyone who is not part of the job without the Customer\'s consent.',
          'Follow all safety rules for your trade and report any accident, damage or dispute at the job to Dialoo support promptly.',
          'You are responsible for any damage you cause and for fixing defective work.',
        ],
      ]},
      { id: 'p-pay', title: 'P8. Money from Customers', body: [
        'Unless the Platform tells you otherwise, you collect payment directly from the Customer for the agreed final amount. Dialoo is not responsible if a Customer does not pay, but we will help you through support where we can, and we may restrict Customers who repeatedly do not pay.',
        'You are responsible for issuing bills or invoices where the law requires, and for the taxes on what you earn.',
      ]},
      { id: 'p-rank', title: 'P9. Ratings, ranking and visibility', body: [
        'How prominently you appear in search depends on factors such as distance, availability, ratings, response time, completion rate, verification, and (once paid plans start) your plan. Dialoo may change how ranking works. We do not guarantee any position.',
        'You must not manipulate ratings, create fake Bookings or Customers, or offer incentives for reviews.',
      ]},
      { id: 'p-data', title: 'P10. Customer data you receive', body: [
        'You will see a Customer\'s name, service address, contact number and job details only to do that Booking. You must use them only for that job, keep them safe, not share or sell them, not contact the Customer for unrelated marketing, and delete them when no longer needed, unless the law requires you to keep records. Misuse of Customer data is a serious breach.',
      ]},
      { id: 'p-suspend', title: 'P11. Suspension, removal and leaving', body: [
        [
          'Dialoo may suspend or remove your profile for false information, fraud, unsafe or abusive behaviour, repeated cancellations or poor ratings, non-payment of due Fees, breach of these terms, legal requirements, or a long period of inactivity.',
          'Where possible we will tell you why and give you a chance to respond, but we may act immediately where there is risk to safety, fraud or legal compulsion.',
          'You may leave at any time by closing your profile after finishing your open Bookings. Fees already paid for a period are handled as described in P3.',
        ],
      ]},
      { id: 'p-liab', title: 'P12. Your liability to Dialoo and to Customers', body: [
        'You are solely responsible to Customers for your Services. You agree to compensate Dialoo for claims, losses and costs arising from your Services, your breach of these terms or the law, or your misuse of Customer data. Dialoo\'s own liability to you is limited as stated in the Terms of Use.',
      ]},
    ],
  },

  privacy: {
    label: ['Privacy Policy', 'गोपनीयता नीति'],
    title: 'Privacy Policy',
    lead: 'How Dialoo collects, uses, shares and protects your personal data, in line with the Digital Personal Data Protection Act, 2023 and the IT Act, 2000.',
    hindi: [
      'हम आपका नाम, मोबाइल नंबर, पता, लोकेशन (अनुमति से), बुकिंग और चैट की जानकारी लेते हैं, ताकि सर्विस बुक हो सके।',
      'आपकी जानकारी बेची नहीं जाती। सिर्फ़ उसी बुकिंग के दूसरे पक्ष और ज़रूरी सेवा-प्रदाताओं (जैसे SMS/OTP, मैप, होस्टिंग) को दी जाती है।',
      'आप अपनी जानकारी देखने, सुधारने या मिटवाने का अनुरोध कर सकते हैं। शिकायत के लिए नीचे दिए संपर्क पर लिखें।',
      'लोकेशन कभी भी फ़ोन की सेटिंग से बंद की जा सकती है।',
    ],
    sections: [
      { id: 'v-collect', title: 'V1. What we collect', body: [[
        'Account details: name, mobile number, email (optional), preferred language, and a password if you set one.',
        'Customer details: saved addresses, favourites, Booking history, chat messages, reviews you write, emergency requests and project or rental posts you create.',
        'Partner details: business name, category, services, prices, experience, shop address, location, verification status and documents you submit, ratings, earnings and plan details.',
        'Location: your device location when you allow it (to find your city, nearby Partners and your address), and a Partner\'s live location while on the way to a job.',
        'Device and usage data: IP address, device and browser type, app version, log and error data, and security events such as login time.',
        'Support communication: messages and records when you contact us.',
      ]]},
      { id: 'v-use', title: 'V2. Why we use it', body: [[
        'To create and secure your account (including OTP verification) and run Bookings, tracking, chat, notifications and reviews.',
        'To show relevant Partners and services in your city and let Partners find Customers.',
        'To verify Partners, prevent fraud and misuse, keep users safe and enforce the Terms.',
        'To provide support, resolve disputes and meet legal obligations.',
        'To improve and measure the Platform. We use your data for advertising only if we tell you and the law allows.',
      ]]},
      { id: 'v-basis', title: 'V3. Your consent and other lawful uses', body: [
        'We process your personal data with your consent (for example when you accept location permission or continue after reading these Terms) and for lawful purposes the law permits without consent, such as to provide a service you asked for, to comply with law, or to respond to a medical emergency or safety threat. You can withdraw consent at any time; this may stop some features from working.',
      ]},
      { id: 'v-share', title: 'V4. Who we share data with', body: [
        'We do not sell your personal data. We share it only as needed:',
        [
          'With the other side of a Booking: a Customer\'s name, service address, contact details and job description go to the chosen Partner; a Partner\'s profile, ratings and, after acceptance, contact number and live location go to the Customer.',
          'With service providers who work for us under confidentiality: SMS and OTP providers, cloud hosting, maps and location services, and similar technology partners.',
          'With authorities, courts or others when required by law or to protect rights, safety or property.',
          'In a business transfer such as a merger or sale, with privacy protections continuing.',
        ],
      ]},
      { id: 'v-location', title: 'V5. Location data', body: [
        'Location is collected only after you give permission in your device or browser. You can turn it off at any time in settings. A Partner\'s live location is shared only with the Customer of that Booking while the Partner is on the way, and live sharing stops when the work starts or the Booking ends.',
      ]},
      { id: 'v-keep', title: 'V6. How long we keep data', body: [
        'We keep data for as long as your account is active and as long as needed for the purposes above. Booking, payment and safety records may be kept for longer where the law, tax rules or dispute handling needs it. When data is no longer needed, we delete or anonymise it.',
      ]},
      { id: 'v-safe', title: 'V7. Security', body: [
        'We use measures such as encrypted connections, hashed passwords and tokens, access controls, rate limits on OTP and login, and audit logs. No system is perfectly secure. Keep your phone, OTP and password safe, and tell us quickly if you suspect misuse. If a personal data breach affects you, we will inform you and the authorities as the law requires.',
      ]},
      { id: 'v-rights', title: 'V8. Your rights', body: [
        'You can ask us to: give you a summary of your personal data and how it is used; correct or complete it; erase it (subject to legal retention); withdraw consent; nominate someone to exercise rights for you if you die or cannot; and address a grievance. Send your request from your registered mobile number or email to the contact below. We may need to verify your identity first.',
      ]},
      { id: 'v-children', title: 'V9. Children', body: [
        'Dialoo is not meant for anyone under 18, and we do not knowingly collect their personal data. If you think a child has given us data, write to us and we will delete it.',
      ]},
      { id: 'v-local', title: 'V10. Data stored on your device', body: [
        'To keep you signed in and make the app faster, Dialoo stores small items on your device such as your login tokens, language, selected city and recently loaded lists (so the app can work with a weak connection). Signing out clears your login tokens and your account-related cache.',
      ]},
      { id: 'v-grievance', title: 'V11. Grievance Officer and contact', body: [
        `Grievance Officer: Dialoo support, ${CONTACT.owner}, ${CONTACT.place}. Email: ${CONTACT.email}. We acknowledge grievances within 48 hours and aim to resolve them within 15 days, or sooner if the law requires.`,
      ]},
      { id: 'v-changes', title: 'V12. Changes to this policy', body: [
        'We may update this policy. The version and date at the top show when it last changed, and we will notify you of significant changes in the app or by SMS.',
      ]},
    ],
  },
};
