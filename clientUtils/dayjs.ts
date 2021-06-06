import dayjs, { Dayjs } from "dayjs/esm"
import utc from "dayjs/esm/plugin/utc"
import relativeTime from "dayjs/esm/plugin/relativeTime"

dayjs.extend(utc)
dayjs.extend(relativeTime)

export default dayjs

// We need these explicit plugin type imports _and exports_ to get the right Dayjs type down the line
import type utcType from "dayjs/esm/plugin/utc"
import type relativeTimeType from "dayjs/esm/plugin/relativeTime"

export type { Dayjs, utcType, relativeTimeType }
