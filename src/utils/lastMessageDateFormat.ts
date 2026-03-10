export function lastMessageDateFormat(
  date: string | Date,
  options?: {
    timeFormat?: '12h' | '24h';
    t?: (key: string) => string;
  },
): string {
  const inputDate = new Date(date);
  const now = new Date();

  if (isNaN(inputDate.getTime())) {
    return 'Invalid date';
  }

  const diffMs = now.getTime() - inputDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const formatTime = (d: Date): string => {
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes.toString();

    if (options?.timeFormat === '24h') {
      const h = hours < 10 ? '0' + hours : hours.toString();
      return `${h}:${formattedMinutes}`;
    }

    const ampm =
      options?.t != null
        ? hours >= 12
          ? options.t('language.time.pm')
          : options.t('language.time.am')
        : hours >= 12
          ? 'PM'
          : 'AM';
    const twelveHour = hours % 12 || 12;
    return `${twelveHour}:${formattedMinutes} ${ampm}`;
  };

  const strTime = formatTime(inputDate);

  if (diffDays === 0) {
    return strTime;
  }

  if (diffDays === 1) {
    return strTime;
  }

  if (diffDays < 7) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[inputDate.getDay()];
  }

  if (inputDate.getFullYear() === now.getFullYear()) {
    const day = inputDate.getDate();
    const month = inputDate.getMonth() + 1;
    const formattedMonth = month < 10 ? '0' + month : month;
    const formattedDay = day < 10 ? '0' + day : day;
    return `${formattedMonth}/${formattedDay}`;
  }

  const day = inputDate.getDate();
  const month = inputDate.getMonth() + 1;
  const year = inputDate.getFullYear().toString().slice(-2);
  const formattedMonth = month < 10 ? '0' + month : month;
  const formattedDay = day < 10 ? '0' + day : day;
  return `${formattedMonth}/${formattedDay}/${year}`;
}

export default lastMessageDateFormat;
