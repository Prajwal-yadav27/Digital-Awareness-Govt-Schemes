const AddToCalendar = ({ event }) => {
  if (!event || !event.eventDate) return null;

  const startDate = new Date(event.eventDate);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // default 2 hours

  const toGoogleFormat = (d) => {
    return d.toISOString().replace(/-|:|\.\d{3}/g, '');
  };

  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${toGoogleFormat(startDate)}/${toGoogleFormat(endDate)}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location || '')}`;

  const toIcsFormat = (d) => d.toISOString().replace(/-|:|\.\d{3}/g, '');

  const generateIcs = () => {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//GovSchemes Portal//EN',
      'BEGIN:VEVENT',
      `UID:${event._id}@govschemes.portal`,
      `DTSTAMP:${toIcsFormat(new Date())}`,
      `DTSTART:${toIcsFormat(startDate)}`,
      `DTEND:${toIcsFormat(endDate)}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
      `LOCATION:${event.location || ''}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="pro-cal-btn"
          onClick={() => window.open(googleUrl, '_blank', 'noopener,noreferrer')}
          aria-label="Add to Google Calendar"
        >
          <span aria-hidden="true">📅</span> Google Calendar
        </button>
        <button
          type="button"
          className="pro-cal-btn"
          onClick={generateIcs}
          aria-label="Download .ics calendar file"
        >
          <span aria-hidden="true">⬇</span> Download .ics
        </button>
      </div>
    </div>
  );
};

export default AddToCalendar;
