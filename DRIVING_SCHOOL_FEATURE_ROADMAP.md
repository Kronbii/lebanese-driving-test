# Driving School Commercial Feature Roadmap

Last updated: 2026-06-24

## Goal

Turn the Lebanese driving theory trainer from a useful public quiz app into a product that driving schools in Lebanon would pay for.

The strongest sales angle is not "students can answer questions online." Existing apps already do that. The product should help schools:

- Increase student pass readiness.
- Reduce repeated instructor explanations.
- Give each school a branded digital training tool.
- Track student progress when the school wants that.
- Keep simple, privacy-friendly local progress for students who do not need accounts.
- Generate leads and WhatsApp conversations for the school.
- Support Arabic-first usage, with English and French where useful.

## Current Strengths

The current app already has several commercially useful foundations:

- Official-style motorcycle theory exam trainer.
- 251 validated questions.
- 101 road-sign image questions.
- 30-question exam mode.
- 25/30 pass threshold.
- Arabic RTL interface.
- Adaptive review using localStorage.
- Wrong-answer memory per device/browser.
- Mobile responsive static site.
- Vercel deployment.
- No backend dependency.

## Privacy And Multi-User Model

The current app stores progress in the browser's `localStorage` under `ldt_progress_v1`.

This means:

- A student's mistakes are saved on their own phone or browser.
- The server does not store answers, mistakes, names, or scores.
- Many users can use the same website and still get different adaptive experiences.
- A new browser profile or different phone starts with separate progress.

This is a good default for public use and for schools that want a simple, low-friction training link.

For schools, use three product modes:

1. Public device-local mode
   - No login.
   - No student personal data.
   - Progress stays on the student's own device.
   - Best for QR-code distribution and WhatsApp sharing.

2. School local profile mode
   - Still no server account required.
   - Multiple local profiles on one school tablet or office computer.
   - Useful when students practice at the school office.

3. Optional school cloud mode
   - Student invite code or login.
   - School dashboard and cross-device reports.
   - Requires consent, privacy policy, and careful data controls.

Lebanon has personal-data regulation under Law No. 81 of 2018, so any cloud tracking should be opt-in, transparent, and minimal.

## Highest-Value Features For Schools

### 1. School Branding

- School logo in the header.
- School colors and theme.
- School contact information.
- Branch address and map link.
- WhatsApp contact button.
- Instagram/TikTok links.
- Custom school landing page.
- Unique school URL, for example `/schools/karim-driving-school`.
- Optional custom domain, for example `learn.schoolname.com`.
- Printable QR code for the school office.
- QR code posters for classrooms, cars, scooters, and reception desks.
- Branded completion certificates.
- Branded progress reports.

Why schools will care:

Students see the app as the school's tool, not a generic public quiz site. This helps retention, referrals, and perceived professionalism.

### 2. Student Local Profiles

- Profile picker on shared devices.
- Create local student profiles without email or password.
- Profile PIN for shared school tablets.
- Separate mistake history per local profile.
- Separate exam history per local profile.
- Reset one profile without clearing all profiles.
- Export profile report as PDF.
- Import/export local profile backup as a file or QR code.

Why schools will care:

Many schools may have students practicing from office devices. Local profiles let multiple students use one device without mixing progress.

### 3. Optional Instructor Dashboard

- Instructor login.
- Student invite codes.
- List of active students.
- Last practice date.
- Exams completed.
- Best score.
- Average score.
- Pass-readiness percentage.
- Weak topics.
- Questions most often answered incorrectly.
- Students ready for theory exam.
- Students at risk.
- Students inactive for 7+ days.
- Branch-level view.
- Instructor-level view.
- Export CSV/PDF.

Why schools will care:

This turns the app into a management tool. Schools can decide who is ready, who needs another lesson, and who needs a reminder.

### 4. Pass-Readiness Score

Instead of only showing the latest score, calculate a readiness score using:

- Last 3 exam scores.
- Mastery level across all questions.
- Coverage percentage.
- Wrong-answer trend.
- Sign-question performance.
- Time since last practice.
- Consistency under timed mode.

Example labels:

- Not ready yet.
- Needs more sign practice.
- Almost ready.
- Exam ready.

Why schools will care:

This helps instructors make a practical decision: can this student go to the official exam, or do they need more training?

### 5. Multilingual Content

- Arabic interface.
- English interface.
- French interface.
- Language switcher.
- Keep official wording mode.
- Add simplified explanation mode.
- Student can practice in one language and review explanations in another.

Why schools will care:

Lebanese students may prefer Arabic, English, or French. Multilingual support is already common in competitor products, so this is likely expected for a paid school tool.

### 6. Add Car License Question Bank

- Category B car theory questions.
- Road-sign questions for car students.
- Separate motorcycle and car modes.
- Combined dashboard for schools.
- Category filter in reports.

Why schools will care:

Motorcycle is useful, but most driving schools will want car-license students too. Adding car support increases the addressable market substantially.

### 7. Exam Simulation Modes

- Official motorcycle exam mode.
- Official car exam mode.
- Timed mode.
- Untimed learning mode.
- Strict mode: cannot review answer until end.
- Practice mode: instant feedback.
- Signs-only exam.
- Weak-questions-only exam.
- Unseen-questions-only exam.
- Final exam day simulation.

Why schools will care:

Schools need both teaching and exam rehearsal. Students need to learn first, then practice under pressure.

### 8. Better Explanations

- Explanation after each wrong answer.
- Explanation for why the correct answer is correct.
- Explanation for why each wrong option is wrong.
- Instructor notes per question.
- Common mistake warning.
- Related road-rule reference.
- Simple Arabic explanation.
- Lebanese Arabic voice explanation.
- Short video explanation for hard concepts.

Why schools will care:

The school saves instructor time because the app answers repeated questions.

### 9. Road Sign Mastery Tools

- Sign gallery.
- Sign flashcards.
- Sign search.
- Sign categories.
- "I know this" and "review again" controls.
- Hide answer until tapped.
- Reverse mode: show meaning, choose sign.
- Signs-only speed drill.
- Most-confused signs report.
- Print sign sheet.

Why schools will care:

Road signs are visual and easy to teach with a dedicated tool. Schools can use this in class and on phones.

### 10. Student Mistake Notebook

- Automatically collect wrong questions.
- Group mistakes by topic.
- Show repeated mistakes.
- Show "fixed" mistakes after consistent correct answers.
- Student can favorite hard questions.
- Student can add a note.
- Instructor can add school-wide notes.
- Daily review queue.

Why schools will care:

This gives students a clear study path and makes the app feel personalized.

## Classroom And Instructor Tools

### Live Classroom Quiz

- Instructor starts a live session.
- Students join by QR code.
- Anonymous or named participation.
- Live answer distribution.
- Instructor reveals correct answer.
- Projector mode.
- Class leaderboard.
- Export class results.

### Projector Mode

- Large text.
- High-contrast mode.
- One question per screen.
- Keyboard navigation.
- Reveal answer button.
- Hide correct answer until discussion.
- Road signs shown large.

### Worksheets And Print

- Generate printable exam.
- Generate answer key.
- Generate signs worksheet.
- Generate weak-topic worksheet.
- Generate student report PDF.
- Print in Arabic, English, or French.

### Instructor Question Notes

- Add private instructor note to a question.
- Add school-wide explanation.
- Flag question as confusing.
- Track which questions need better explanation.

## Student Engagement Features

- Daily practice reminder.
- WhatsApp reminder link.
- Practice streak.
- XP points.
- Badges for coverage and mastery.
- "Ready for exam" badge.
- Weekly progress summary.
- Share result with instructor via WhatsApp.
- Share certificate image.
- Mobile install prompt.
- Offline mode.
- Low-data mode.
- Dark/light theme.
- Font size setting.
- Audio read-aloud.

## School Operations Features

- Student registration form.
- Lead capture from public school page.
- WhatsApp inquiry button.
- Appointment request form.
- Theory exam booking reminder.
- Practical lesson booking.
- Package tracking:
  - Theory only.
  - Motorcycle license.
  - Car license.
  - Full package.
- Payment status notes.
- Branch selector.
- Instructor assignment.
- Student status:
  - New lead.
  - Registered.
  - Practicing.
  - Exam ready.
  - Passed.
  - Inactive.

## Marketing And Sales Features

- School public landing page.
- "Start free practice" CTA.
- "Contact us on WhatsApp" CTA.
- Student testimonials.
- Pass-rate stats, only if verified.
- Number of students trained.
- Number of completed exams.
- Embed widget for school website.
- Instagram story share card.
- TikTok-friendly progress screenshots.
- Custom QR poster generator.
- Branded certificate generator.
- Referral link per school.
- Referral tracking from QR codes.

## Admin And SaaS Features

- Super admin dashboard.
- Create school tenant.
- Manage school branding.
- Manage school users.
- Manage branches.
- Manage instructor accounts.
- Manage student limits.
- Activate/deactivate school subscription.
- Usage analytics.
- Billing status.
- Plan limits.
- Audit log.
- Data export.
- Data deletion tools.

## Privacy, Consent, And Compliance Features

Needed only if cloud dashboards or student accounts are added:

- Privacy policy in Arabic and English.
- Student consent screen.
- Clear explanation of what is stored.
- Data-minimization settings.
- School admin data retention controls.
- Delete student data button.
- Export student data button.
- No unnecessary personal data.
- Separate anonymous local mode from tracked school mode.
- Role-based access control.
- Secure passwordless login or invite-code login.
- HTTPS only.
- Backups.
- Access logs.

## Technical Features

- PWA install support.
- Service worker for offline use.
- Asset caching for signs.
- Data versioning.
- Question bank update pipeline.
- Question-bank checksum.
- Admin import from structured JSON/CSV.
- Automated validation:
  - Every question has 3 options.
  - Exactly one correct answer.
  - Sign image exists.
  - Arabic text renders correctly.
- Error monitoring.
- Analytics without personal tracking in public mode.
- Multi-tenant configuration.
- Feature flags per school.
- CDN caching.
- Backup and restore.
- Mobile viewport regression tests.

## AI Features

Use AI only where it creates real school value:

- Arabic tutor that explains a wrong answer.
- "Explain this like I am nervous before the exam."
- Auto-generate simple explanations for each question.
- Auto-generate instructor notes.
- Detect confusing questions from wrong-answer patterns.
- Recommend a student practice plan.
- Predict readiness based on learning history.
- Translate question explanations into English/French.
- Voice explanation generation.

Important: AI should not change official question wording unless the app clearly labels it as explanation, not official text.

## Product Packages

### Starter

Best for small schools that only want a branded tool.

- Branded page.
- School logo and contact links.
- QR code.
- Device-local progress.
- Motorcycle exam trainer.
- Mobile PWA.

### Pro

Best for schools that want student management.

- Everything in Starter.
- Car and motorcycle banks.
- Local profiles.
- Student invite codes.
- Instructor dashboard.
- Readiness score.
- PDF reports.
- WhatsApp progress sharing.

### Premium

Best for larger schools or multiple branches.

- Everything in Pro.
- Cloud student accounts.
- Branch and instructor management.
- Live classroom quiz.
- Projector mode.
- Custom domain.
- AI explanations.
- Advanced analytics.
- Lead capture and CRM features.

## Implementation Priority

### Phase 1: Sellable MVP For Schools

1. School branding configuration.
2. School landing pages.
3. QR code generation.
4. WhatsApp contact/share buttons.
5. PWA install/offline caching.
6. Local student profiles.
7. PDF progress report.
8. Car question bank, if source material is available.

### Phase 2: Instructor Value

1. Optional student invite codes.
2. Instructor dashboard.
3. Readiness score.
4. Weak-topic reports.
5. Printable worksheets.
6. Projector mode.
7. Live classroom quiz.

### Phase 3: SaaS Platform

1. Multi-school tenant system.
2. Cloud accounts.
3. Branch and instructor roles.
4. Billing/subscriptions.
5. Admin dashboard.
6. AI tutor/explanations.
7. CRM and lead capture.

## Sales Pitch

Short pitch:

"A branded mobile training platform for Lebanese driving schools that helps students practice official-style theory questions, remembers their mistakes on their own device, and gives schools optional tools to track readiness, reduce repeated teaching, and bring students back through WhatsApp."

More direct pitch:

"Instead of telling students to use a generic quiz app, give them your school's own training link. They scan your QR code, practice on their phone, review their own mistakes, and contact your school when they are ready for lessons or the exam."

## Competitive Notes

Existing Lebanese driving-test tools commonly offer:

- Arabic, English, and French support.
- Mock exams.
- Road signs.
- Progress tracking.
- Wrong-question review.
- Timers.

To be worth paying for, this product should differentiate through:

- School branding.
- School-specific URLs and QR codes.
- Local-first privacy.
- Instructor dashboards.
- Student readiness reporting.
- Classroom/projector tools.
- Optional cloud tracking for schools that want it.
- Better explanations and study plans.

## Source Links Checked

- DataReportal Lebanon 2026: https://datareportal.com/reports/digital-2026-lebanon
- Lebanon Driving Quiz: https://lebanondrivingquiz.com/
- SOU2LB: https://sou2lb.com/
- Google Play Lebanese driving test app: https://play.google.com/store/apps/details?hl=en_US&id=com.msaya.lebanon.driving.test
- Compu Vision driving license practice system: https://www.compu-vision.me/product/37/Driving%2BLicense%2BPractice%2BTest/
- DLA Piper Lebanon data protection summary: https://www.dlapiperdataprotection.com/?c=LB&t=law

