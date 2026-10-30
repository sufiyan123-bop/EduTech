// UI-only helper for Cloudflare classroom locks. The server remains authoritative.
export function canWatchLecture({course,lecture,enrolled=false,signedIn=false}) {
 if (!lecture) return false;
 if (enrolled) return true;
 if (!course || course.status === "comingSoon") return false;
 // Bundle folders are intentionally unpublished; the rules verify their parent is published.
 if (signedIn && lecture.trialEnabled === true && (course.published === true || course.folderOnly === true)) return true;
 return course.published === true && Number(course.price ?? 0) === 0 && lecture.freePreview === true;
}
