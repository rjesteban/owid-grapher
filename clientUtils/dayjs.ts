import dayjs, { Dayjs } from "dayjs"
import utc from "dayjs/plugin/utc"

dayjs.extend(utc)

export default dayjs

export { Dayjs }
