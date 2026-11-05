import type { Locale } from "@/i18n/routing";

export const authCopy = {
  en: {
    eyebrow: "IDENTITY / IOJH 2.0", back: "Return to IOJH", accountLabel: "Researcher account",
    asideMark: "YOUR RESEARCH / YOUR ACCESS", asideTitle: "A quieter space for serious work.",
    asideBody: "One verified identity for future learning, orders and mentorship. The research and publishing services remain independent from your private account.",
    asideFoot: "Accounts are distinct from IOJH website administration.",
    signInTitle: "Welcome back.", signInIntro: "Sign in to your IOJH account using a verified email address.",
    signUpTitle: "Start with your identity.", signUpIntro: "Create a personal account for future IOJH learning and services.",
    forgotTitle: "Find your way back.", forgotIntro: "Enter your account email to request a secure password reset link.",
    resetTitle: "Choose a new password.", resetIntro: "Your recovery link has been verified. Set a new password, then sign in again.",
    verifyTitle: "Check your inbox.", verifyIntro: "If registration was accepted, follow the verification link sent to your email address. You must verify your email before account access.",
    email: "Email address", password: "Password", confirm: "Confirm password", show: "Show password", hide: "Hide password",
    signIn: "Sign in", signUp: "Create account", recover: "Send recovery instructions", update: "Save new password",
    signInLink: "Already have an account? Sign in", signUpLink: "New to IOJH? Create an account", forgotLink: "Forgot your password?", verifyBack: "Go to sign in",
    passwordHint: "At least 10 characters. Choose a unique password.",
    errors: {
      not_configured: "Authentication has not been connected to the IOJH Supabase project yet. No account was created or changed.",
      validation: "Please enter a valid email and complete all fields. New passwords need at least 10 characters.",
      password_mismatch: "The two passwords do not match.",
      credentials: "Sign-in failed. Check your credentials and verify your email before trying again.",
      verify_required: "Verify your email address before signing in.",
      unavailable: "The authentication service could not complete this request. Please try again later.",
      rate_limit: "Too many attempts. Please wait and try again later.",
      reset_required: "Your recovery session has expired or is missing. Request a fresh password reset link."
    },
    success: {
      check_email: "If registration was accepted, check your inbox to verify your email. Account access requires verification.",
      reset_sent: "If that email is registered, you will receive recovery instructions. Check your inbox and spam folder.",
      password_changed: "Your password was updated. Please sign in again using your new password."
    },
    notConfigured: "Account access is not enabled until the owner configures the IOJH Supabase Auth project. The public site remains available.",
    accountEyebrow: "PRIVATE / ACCOUNT", accountTitle: "Your IOJH account.", accountBody: "Your identity is verified. Course enrollment, book orders, mentorship and account preferences will be added in later development packets.",
    verified: "Email verified", signOut: "Sign out", inactive: "Not yet available", setup: "Authentication setup required", privacy: "No payment or course access is enabled in this authentication stage.",
    recoveryNeeded: "Open the valid password reset link from your email to continue. If it expired, request a new link.",
    callbackError: "This email link is invalid or expired. You can request a new recovery link or sign in if your email is already verified."
  },
  bn: {
    eyebrow: "পরিচয় / IOJH ২.০", back: "IOJH-এ ফিরে যান", accountLabel: "গবেষকের অ্যাকাউন্ট",
    asideMark: "আপনার গবেষণা / আপনার প্রবেশাধিকার", asideTitle: "গবেষণার জন্য আপনার নিজস্ব পরিসর।",
    asideBody: "ভবিষ্যতে শিক্ষা, অর্ডার ও মেন্টরশিপ সেবার জন্য একটি যাচাইকৃত পরিচয়। আপনার ব্যক্তিগত অ্যাকাউন্ট ও ওয়েবসাইট পরিচালনা পৃথক।",
    asideFoot: "এই অ্যাকাউন্টের মাধ্যমে ওয়েবসাইট প্রশাসনের অনুমতি পাওয়া যায় না।",
    signInTitle: "আবার স্বাগতম।", signInIntro: "যাচাইকৃত ইমেইল ঠিকানা দিয়ে আপনার IOJH অ্যাকাউন্টে প্রবেশ করুন।",
    signUpTitle: "আপনার পরিচয় দিয়ে শুরু করুন।", signUpIntro: "ভবিষ্যতের IOJH শিক্ষা ও সেবার জন্য ব্যক্তিগত অ্যাকাউন্ট তৈরি করুন।",
    forgotTitle: "আবার প্রবেশ করুন।", forgotIntro: "নিরাপদ পাসওয়ার্ড পুনর্নির্ধারণের লিংক পেতে অ্যাকাউন্টের ইমেইল লিখুন।",
    resetTitle: "নতুন পাসওয়ার্ড নির্ধারণ করুন।", resetIntro: "আপনার পুনরুদ্ধার লিংক যাচাই হয়েছে। নতুন পাসওয়ার্ড দিয়ে পরে আবার সাইন ইন করুন।",
    verifyTitle: "ইমেইল দেখুন।", verifyIntro: "নিবন্ধন গ্রহণ করা হলে ইমেইলে পাঠানো যাচাইকরণ লিংক ব্যবহার করুন। অ্যাকাউন্টে প্রবেশের আগে ইমেইল যাচাই করতে হবে।",
    email: "ইমেইল ঠিকানা", password: "পাসওয়ার্ড", confirm: "পাসওয়ার্ড নিশ্চিত করুন", show: "পাসওয়ার্ড দেখান", hide: "পাসওয়ার্ড আড়াল করুন",
    signIn: "সাইন ইন", signUp: "অ্যাকাউন্ট তৈরি করুন", recover: "পুনরুদ্ধারের নির্দেশনা পাঠান", update: "নতুন পাসওয়ার্ড সংরক্ষণ করুন",
    signInLink: "অ্যাকাউন্ট আছে? সাইন ইন করুন", signUpLink: "নতুন ব্যবহারকারী? অ্যাকাউন্ট তৈরি করুন", forgotLink: "পাসওয়ার্ড ভুলে গেছেন?", verifyBack: "সাইন ইনে ফিরে যান",
    passwordHint: "কমপক্ষে ১০ অক্ষর। অন্য কোথাও ব্যবহার করেননি এমন পাসওয়ার্ড দিন।",
    errors: {
      not_configured: "IOJH Supabase প্রকল্পের সঙ্গে পরিচয় যাচাই এখনো যুক্ত হয়নি। কোনো অ্যাকাউন্ট তৈরি বা পরিবর্তন হয়নি।",
      validation: "সঠিক ইমেইল লিখুন এবং সব ঘর পূরণ করুন। নতুন পাসওয়ার্ড কমপক্ষে ১০ অক্ষরের হতে হবে।",
      password_mismatch: "দুইটি পাসওয়ার্ড এক নয়।",
      credentials: "সাইন ইন করা যায়নি। তথ্য পরীক্ষা করুন এবং ইমেইল যাচাই করুন।",
      verify_required: "সাইন ইন করার আগে ইমেইল যাচাই করুন।",
      unavailable: "এখন পরিচয় যাচাই সেবাটি ব্যবহার করা যাচ্ছে না। পরে আবার চেষ্টা করুন।",
      rate_limit: "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
      reset_required: "পাসওয়ার্ড পুনরুদ্ধার সেশন পাওয়া যায়নি বা মেয়াদ শেষ। নতুন লিংক নিন।"
    },
    success: {
      check_email: "নিবন্ধন গ্রহণ করা হলে ইমেইলে যাচাইকরণের নির্দেশনা পাবেন। যাচাই ছাড়া অ্যাকাউন্টে প্রবেশ করা যাবে না।",
      reset_sent: "ইমেইলটি নিবন্ধিত থাকলে পুনরুদ্ধারের নির্দেশনা পাঠানো হবে। ইনবক্স ও স্প্যাম দেখুন।",
      password_changed: "পাসওয়ার্ড পরিবর্তন হয়েছে। নতুন পাসওয়ার্ড দিয়ে আবার সাইন ইন করুন।"
    },
    notConfigured: "IOJH-এর Supabase Auth প্রকল্প কনফিগার না হওয়া পর্যন্ত অ্যাকাউন্ট সেবা চালু হবে না। মূল ওয়েবসাইট ব্যবহার করা যাবে।",
    accountEyebrow: "ব্যক্তিগত / অ্যাকাউন্ট", accountTitle: "আপনার IOJH অ্যাকাউন্ট।", accountBody: "আপনার পরিচয় যাচাই হয়েছে। কোর্স, বইয়ের অর্ডার, মেন্টরশিপ ও সেটিংস পরবর্তী উন্নয়ন ধাপে যোগ হবে।",
    verified: "ইমেইল যাচাইকৃত", signOut: "সাইন আউট", inactive: "এখনো চালু নয়", setup: "অ্যাকাউন্টের সেটআপ প্রয়োজন", privacy: "এই ধাপে পেমেন্ট বা কোর্সে প্রবেশের ব্যবস্থা চালু নয়।",
    recoveryNeeded: "ইমেইলের বৈধ পাসওয়ার্ড পুনরুদ্ধার লিংক খুলুন। মেয়াদ শেষ হলে নতুন লিংকের অনুরোধ করুন।",
    callbackError: "এই ইমেইল লিংকটি অবৈধ বা এর মেয়াদ শেষ। নতুন লিংক চাইতে পারেন কিংবা যাচাইকৃত ইমেইল দিয়ে সাইন ইন করুন।"
  }
} as const;

export function getAuthCopy(locale: Locale) { return authCopy[locale]; }
