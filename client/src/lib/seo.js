// Per-page titles and descriptions. The build step (scripts/postbuild.mjs) reads the
// same data so crawlers and social scrapers get correct tags WITHOUT running JavaScript.
export const pages = {
  '/': {
    title: 'AttendEase | Track Attendance and Avoid Detention',
    description:
      'AttendEase helps SRGEC students track subject-wise attendance, see how many classes they can safely skip, and plan recovery before detention.',
  },
  '/privacy': {
    title: 'Privacy Policy | AttendEase',
    description:
      'How AttendEase collects, uses and protects your information, including cookies, analytics and your rights under Indian data protection law.',
  },
  '/terms': {
    title: 'Terms and Conditions | AttendEase',
    description:
      'The rules for using AttendEase, an independent student-run attendance tracker that is not an official college record.',
  },
  '/login': {
    title: 'Log in | AttendEase',
    description: 'Log in to AttendEase with your college roll number to see your attendance.',
  },
  '/register': {
    title: 'Create an Account | AttendEase',
    description: 'Create an AttendEase account with your SRGEC roll number to track attendance subject by subject.',
  },
  '/dashboard': { title: 'Dashboard | AttendEase', description: 'Your AttendEase dashboard.', noindex: true },
  '/attendance': { title: 'Show Attendance | AttendEase', description: 'Your subject-wise attendance.', noindex: true },
  '/attendance/mark': { title: 'Mark Attendance | AttendEase', description: 'Enter your daily attendance.', noindex: true },
  '/attendance/predict': { title: 'Prediction | AttendEase', description: 'Safe-leave and recovery calculator.', noindex: true },
  '/statistics': { title: 'Statistics | AttendEase', description: 'Your attendance statistics.', noindex: true },
  '/timetable': { title: 'My Timetable | AttendEase', description: 'Your subjects and weekly timetable.', noindex: true },
  '/todos': { title: 'To-do List | AttendEase', description: 'Your tasks.', noindex: true },
  '/profile': { title: 'Profile | AttendEase', description: 'Your profile.', noindex: true },
  '/admin': { title: 'Admin | AttendEase', description: 'AttendEase administration.', noindex: true },
  '/404': {
    title: 'Page not found | AttendEase',
    description: 'The page you were looking for does not exist. Head back to the AttendEase home page.',
    noindex: true,
  },
}
