export interface ShiftCheckResult {
  eligible: boolean
  shift?: 'morning' | 'afternoon'
  status?: 'on_time' | 'late'
  message?: string
}

export interface ShiftConfig {
  morningStart: string
  morningLate: string
  morningEnd: string
  afternoonStart: string
  afternoonLate: string
  afternoonEnd: string
}

export const DEFAULT_SHIFT_CONFIG: ShiftConfig = {
  morningStart: '07:30',
  morningLate: '07:56',
  morningEnd: '08:30',
  afternoonStart: '13:00',
  afternoonLate: '13:26',
  afternoonEnd: '14:00',
}

/**
 * Checks if a specific date/time falls within the designated shift check-in windows.
 * Supports custom configurations passed from Google Sheets.
 */
export function checkShiftTime(
  date: Date = new Date(),
  config: ShiftConfig = DEFAULT_SHIFT_CONFIG
): ShiftCheckResult {
  // Convert standard date to Vietnam (GMT+7) local date time representation
  const vnTimeStr = date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
  const vnDate = new Date(vnTimeStr)

  const hours = vnDate.getHours()
  const minutes = vnDate.getMinutes()
  const seconds = vnDate.getSeconds()

  // Total seconds from midnight
  const timeInSeconds = hours * 3600 + minutes * 60 + seconds

  // Helper to parse 'HH:mm' to seconds from midnight
  const timeToSeconds = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number)
    return h * 3600 + m * 60
  }

  const morningStartSec = timeToSeconds(config.morningStart)
  const morningLateSec = timeToSeconds(config.morningLate)
  const morningEndSec = timeToSeconds(config.morningEnd)

  const afternoonStartSec = timeToSeconds(config.afternoonStart)
  const afternoonLateSec = timeToSeconds(config.afternoonLate)
  const afternoonEndSec = timeToSeconds(config.afternoonEnd)

  // Morning Shift Check
  if (timeInSeconds >= morningStartSec && timeInSeconds <= morningEndSec) {
    const isLate = timeInSeconds >= morningLateSec
    return {
      eligible: true,
      shift: 'morning',
      status: isLate ? 'late' : 'on_time',
    }
  }

  // Afternoon Shift Check
  if (timeInSeconds >= afternoonStartSec && timeInSeconds <= afternoonEndSec) {
    const isLate = timeInSeconds >= afternoonLateSec
    return {
      eligible: true,
      shift: 'afternoon',
      status: isLate ? 'late' : 'on_time',
    }
  }

  return {
    eligible: false,
    message: `Hiện tại không nằm trong khung giờ check-in hợp lệ (Sáng: ${config.morningStart} - ${config.morningEnd}, Chiều: ${config.afternoonStart} - ${config.afternoonEnd})`,
  }
}
