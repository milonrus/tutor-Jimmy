import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

export interface RateLimitData {
  identifier: string;
  requestCount: number;
  firstRequestAt: Timestamp;
  lastRequestAt: Timestamp;
  resetAt: Timestamp;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: Date;
  isAnonymous: boolean;
}

const ANONYMOUS_REQUEST_LIMIT = 3;
const RATE_LIMIT_WINDOW_HOURS = 24 * 7; // 7 days = 168 hours

/**
 * Check if a user can make a request and update their rate limit data
 */
export async function checkRateLimit(userId: string, isAnonymous: boolean): Promise<RateLimitResult> {
  // Authenticated non-anonymous users have unlimited requests
  if (!isAnonymous) {
    return {
      allowed: true,
      remainingRequests: -1, // -1 indicates unlimited
      resetTime: new Date(),
      isAnonymous: false
    };
  }

  const rateLimitDoc = doc(db, 'rateLimits', userId);

  try {
    const docSnap = await getDoc(rateLimitDoc);
    const now = new Date();

    if (!docSnap.exists()) {
      // First request for this user
      const resetTime = new Date(now.getTime() + RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000);

      await setDoc(rateLimitDoc, {
        identifier: userId,
        requestCount: 1,
        firstRequestAt: serverTimestamp(),
        lastRequestAt: serverTimestamp(),
        resetAt: Timestamp.fromDate(resetTime)
      });

      return {
        allowed: true,
        remainingRequests: ANONYMOUS_REQUEST_LIMIT - 1,
        resetTime,
        isAnonymous: true
      };
    }

    const data = docSnap.data() as RateLimitData;
    const resetTime = data.resetAt.toDate();

    // Check if rate limit window has expired
    if (now > resetTime) {
      // Reset the rate limit
      const newResetTime = new Date(now.getTime() + RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000);

      await updateDoc(rateLimitDoc, {
        requestCount: 1,
        firstRequestAt: serverTimestamp(),
        lastRequestAt: serverTimestamp(),
        resetAt: Timestamp.fromDate(newResetTime)
      });

      return {
        allowed: true,
        remainingRequests: ANONYMOUS_REQUEST_LIMIT - 1,
        resetTime: newResetTime,
        isAnonymous: true
      };
    }

    // Check if user has exceeded the limit
    if (data.requestCount >= ANONYMOUS_REQUEST_LIMIT) {
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime,
        isAnonymous: true
      };
    }

    // Increment the request count
    const newRequestCount = data.requestCount + 1;
    await updateDoc(rateLimitDoc, {
      requestCount: newRequestCount,
      lastRequestAt: serverTimestamp()
    });

    return {
      allowed: true,
      remainingRequests: ANONYMOUS_REQUEST_LIMIT - newRequestCount,
      resetTime,
      isAnonymous: true
    };

  } catch (error) {
    console.error('Error checking rate limit:', error);
    // On error, allow the request but log the issue
    return {
      allowed: true,
      remainingRequests: ANONYMOUS_REQUEST_LIMIT,
      resetTime: new Date(),
      isAnonymous: true
    };
  }
}

/**
 * Get current rate limit status without incrementing
 */
export async function getRateLimitStatus(userId: string, isAnonymous: boolean): Promise<RateLimitResult> {
  // Authenticated non-anonymous users have unlimited requests
  if (!isAnonymous) {
    return {
      allowed: true,
      remainingRequests: -1, // -1 indicates unlimited
      resetTime: new Date(),
      isAnonymous: false
    };
  }

  const rateLimitDoc = doc(db, 'rateLimits', userId);

  try {
    const docSnap = await getDoc(rateLimitDoc);

    if (!docSnap.exists()) {
      // No requests made yet
      return {
        allowed: true,
        remainingRequests: ANONYMOUS_REQUEST_LIMIT,
        resetTime: new Date(),
        isAnonymous: true
      };
    }

    const data = docSnap.data() as RateLimitData;
    const resetTime = data.resetAt.toDate();
    const now = new Date();

    // Check if rate limit window has expired
    if (now > resetTime) {
      return {
        allowed: true,
        remainingRequests: ANONYMOUS_REQUEST_LIMIT,
        resetTime: new Date(now.getTime() + RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000),
        isAnonymous: true
      };
    }

    const remainingRequests = Math.max(0, ANONYMOUS_REQUEST_LIMIT - data.requestCount);

    return {
      allowed: remainingRequests > 0,
      remainingRequests,
      resetTime,
      isAnonymous: true
    };

  } catch (error) {
    console.error('Error getting rate limit status:', error);
    // On error, return default status
    return {
      allowed: true,
      remainingRequests: ANONYMOUS_REQUEST_LIMIT,
      resetTime: new Date(),
      isAnonymous: true
    };
  }
}

/**
 * Format time remaining until rate limit reset
 */
export function formatTimeUntilReset(resetTime: Date): string {
  const now = new Date();
  const timeDiff = resetTime.getTime() - now.getTime();

  if (timeDiff <= 0) {
    return 'Rate limit has reset';
  }

  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}