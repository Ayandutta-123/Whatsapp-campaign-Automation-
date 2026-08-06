export default function WhatsAppPreview({ template, businessName = 'WhatsApp Campaign Automation' }) {
  const renderBody = (text) => {
    if (!text) return null;
    const parts = text.split(/(\{\{\d+\}\})/g);
    return parts.map((part, i) => {
      if (/\{\{\d+\}\}/.test(part)) {
        const labels = { '{{1}}': 'Name', '{{2}}': 'Company', '{{3}}': 'Phone', '{{4}}': 'Email' };
        return (
          <span key={i} className="text-accent font-medium">
            [{labels[part] || part.replace(/[{}]/g, '')}]
          </span>
        );
      }
      return part;
    });
  };

  const buttons = Array.isArray(template?.buttons) && template.buttons.length > 0
    ? template.buttons
    : template?.button_text
      ? [{ type: 'QUICK_REPLY', text: template.button_text }]
      : [];

  const btnIcon = (type) => {
    if (type === 'URL') return '↗';
    if (type === 'PHONE_NUMBER') return '📞';
    return '↩';
  };

  return (
    <div className="mx-auto w-full max-w-[280px] sm:max-w-[300px]">
      <div className="rounded-[2rem] border-4 border-gray-800 overflow-hidden shadow-xl bg-gray-800">
        <div className="bg-gray-800 px-4 py-2">
          <div className="w-20 h-1 bg-gray-600 rounded-full mx-auto" />
        </div>
        <div className="bg-whatsapp-header px-4 py-3 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20" />
          <span className="text-white text-sm font-medium">{businessName}</span>
        </div>
        <div className="bg-whatsapp-chat p-4 min-h-[320px]">
          <div className="max-w-[90%] shadow-sm">
            <div className="bg-white rounded-lg rounded-tl-none p-3">
              {template?.header_type === 'text' && template?.header_value && (
                <p className="font-semibold text-sm mb-1">{template.header_value}</p>
              )}
              {template?.header_type === 'image' && (
                template?.header_image_preview ? (
                  <img
                    src={template.header_image_preview}
                    alt="Header"
                    className="rounded mb-2 w-full h-32 object-cover"
                  />
                ) : (
                  <div className="bg-gray-200 rounded h-24 mb-2 flex items-center justify-center text-gray-400 text-xs">
                    Upload logo / image
                  </div>
                )
              )}
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {renderBody(template?.body_text)}
              </p>
              {template?.footer_text && (
                <p className="text-xs text-gray-400 mt-2">{template.footer_text}</p>
              )}
              <div className="flex justify-end items-center gap-1 mt-1">
                <span className="text-[10px] text-gray-400">10:30 AM</span>
                <span className="text-blue-400 text-xs">✓✓</span>
              </div>
            </div>
            {buttons.length > 0 && (
              <div className="mt-[2px] space-y-[2px]">
                {buttons.map((btn, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-lg px-3 py-2 text-center border-t"
                  >
                    <span className="text-xs text-[#00a884] font-semibold">
                      {btnIcon(btn.type)} {btn.text || 'Button'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
