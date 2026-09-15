# កំណត់ចំណាំ Dashboard — 12 កញ្ញា 2026

## អ្វីដែលបានកែ

1. ចុចចំណងជើង Booking ដើម្បីមើលព័ត៌មានលម្អិត៖ ថ្ងៃ ម៉ោង បន្ទប់ ផ្នែក អ្នកសម្របសម្រួល ទូរស័ព្ទ អ្នកចូលរួម បុគ្គលិកបច្ចេកទេស សម្ភារៈ និងកំណត់ចំណាំ។
2. កែផ្ទាំង Edit និង Cancel ឱ្យបង្ហាញនៅកណ្ដាល។ Keyboard focus ស្ថិតក្នុងផ្ទាំង ហើយ Escape បិទផ្ទាំងបាន។ ពេលកំពុងរក្សាទុក ប៊ូតុងត្រូវបានបិទដើម្បីទប់ការចុចស្ទួន។
3. បង្ហាញឈ្មោះ Email និងតួនាទីក្នុង Dashboard។
4. User Control មានការស្វែងរក តម្រងសកម្ម/បានបិទ ការបោះបង់ការកែ និងការបញ្ជាក់មុនបិទ/បើកសិទ្ធិ។ ការបិទសិទ្ធិមិនអនុវត្តការកែឈ្មោះ ឬតួនាទីដែលមិនទាន់ Save ទេ។
5. Login Screen ពន្យល់ថាត្រូវប្រើ Google account ដែលបានផ្តល់សិទ្ធិ និងបង្ហាញផ្លូវទៅ Form សាធារណៈ។
6. របាយការណ៍ការកក់មានតម្រងពីថ្ងៃ/ដល់ថ្ងៃ បន្ទប់ និងស្ថានភាព។ អាចទាញយក CSV ឬបោះពុម្ព/Save as PDF តាម Browser។
7. Inventory មានតែ Menu និងទំព័រទទេ តាមសំណើ។
8. Menu មាន URL hash ដើម្បី Refresh ឬប្រើ Back/Forward ទៅផ្នែកមុន។

## សិទ្ធិ

| តួនាទី | មើលការកក់ និងរបាយការណ៍ / CSV | កែ និងលុបចោលការកក់ | គ្រប់គ្រងអ្នកប្រើ |
|---|---|---|---|
| Owner | បាន | បាន | បាន |
| Editor | បាន | បាន | មិនបាន |
| Viewer | បាន | មិនបាន | មិនបាន |

Form ស្នើសុំបន្ទប់នៅតែអាចប្រើបានដោយអ្នកណាក៏បានដែលមាន Link។ ការបន្ថែមអ្នកប្រើក្នុង Dashboard គឺផ្តល់សិទ្ធិទៅ Google account ដែលមានស្រាប់ មិនមែនបង្កើតគណនី Google ថ្មីទេ។

## របាយការណ៍

- ចម្រាញ់តាមថ្ងៃប្រជុំ រួមបញ្ចូលថ្ងៃដំបូង និងថ្ងៃចុងក្រោយ។
- ប្រើម៉ោងកម្ពុជា Asia/Phnom_Penh។
- ចំនួនអ្នកចូលរួមគឺផលបូកតាមការកក់ដែលបានបញ្ជាក់ មិនមែនមនុស្សមិនស្ទួន ឬវត្តមានជាក់ស្តែង។
- CSV ប្រើ UTF-8 សម្រាប់អក្សរខ្មែរ និងទប់ spreadsheet formula injection។
- របាយការណ៍អានទិន្នន័យ Bookings ដែលបានភ្ជាប់បច្ចុប្បន្ន។ ទិន្នន័យចាស់ 868 កំណត់ត្រាមិនទាន់ Import ក្នុងការកែនេះទេ។

## ការផ្ទៀងផ្ទាត់

- TypeScript, lint និង production build បានឆ្លងកាត់។
- Tests ចំនួន 42 បានឆ្លងកាត់៖ Google authentication, role permissions, user store, Inventory, reports, Calendar និង Telegram sync។
- Inventory សម្រាប់សម្ភារៈប្រជុំប្រើ ID ខ្លី `EQ-001` និងគ្រប់គ្រងតាមចំនួនសរុប។ Owner អាចបន្ថែម/កែ/បិទ Item; Editor និង Viewer មើលបាន; Guest មិនអាចចូលបាន។
- បានពិនិត្យផ្ទាល់លើ Cloudflare៖ Booking details, Edit layout, Escape/focus return, report totals/room filter និង Inventory ទទេ។
- Anonymous GET/PATCH/DELETE លើ admin bookings ត្រូវបានបដិសេធ 401។
- មិនបានបង្កើតអ្នកប្រើសាកល្បង ឬកែ/លុប Booking ពិតក្នុងការឆែក UX នេះទេ។ Login UI ត្រូវបានកែ និង build-check; មិនបានចាកចេញពី session របស់ម្ចាស់ប្រព័ន្ធដើម្បីសាកល្បង Google popup ម្តងទៀតទេ។ Mobile និង Print/PDF មិនទាន់បានពិនិត្យផ្ទាល់លើឧបករណ៍ទាំងអស់។

Dialog behavior follows the [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) for contained focus, Escape and return focus. This is not a claim of full WCAG certification.
