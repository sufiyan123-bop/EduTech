// Mirror Firestore lecture-read policy in the UI. Firestore rules remain authoritative.
export function canWatchLecture({course,lecture,enrolled=false,trialActive=false}) {
 if (!lecture) return false;
 if (enrolled) return true;
 if (!course || course.published !== true || course.status === "comingSoon") return false;
 return (Number(course.price ?? 0) === 0 && lecture.freePreview === true) || (trialActive && lecture.trialEnabled === true);
}
