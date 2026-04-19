// Contact/About modal — full-screen overlay triggered from Sidebar bottom button.

import { useEffect } from 'react';
import { X, Linkedin, Github, Globe, Mail, Award } from 'lucide-react';

interface ContactLink {
  icon: React.ReactNode;
  label: string;
  href: string;
}

const links: ContactLink[] = [
  {
    icon: <Linkedin size={20} />,
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/khizar246/',
  },
  {
    icon: <Github size={20} />,
    label: 'GitHub',
    href: 'https://github.com/Khizar246',
  },
  {
    icon: <Globe size={20} />,
    label: 'Portfolio',
    href: 'https://khizar246.github.io/Khizar-Portfolio.github.io/',
  },
  {
    icon: <Mail size={20} />,
    label: 'Email',
    href: 'mailto:Khizerwork75@gmail.com',
  },
  {
    icon: <Award size={20} />,
    label: 'Azure Cert',
    href: 'https://learn.microsoft.com/en-us/users/mohdkhizar-5428/credentials/dffcb2ded1ff5bed',
  },
];

interface ContactFloatProps {
  open: boolean;
  onClose: () => void;
}

export default function ContactFloat({ open, onClose }: ContactFloatProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#111111] border border-[#262626] rounded-[12px] p-8 w-full max-w-[480px] mx-4 relative">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-md text-[#525252] hover:text-[#fafafa] hover:bg-[#1a1a1a] transition-colors duration-150"
          aria-label="Close"
        >
          <X size={15} />
        </button>

        {/* Avatar + identity */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-[10px] bg-amber-400 flex items-center justify-center text-[#0a0a0a] text-[22px] font-bold mb-5">
            MK
          </div>
          <p className="text-[20px] font-semibold text-[#fafafa] mb-1">Mohd Khizar</p>
          <p className="text-[13px] text-[#525252] mb-1">Data Analyst | AI Enthusiast</p>
          <p className="text-[13px] text-[#525252] mb-6 max-w-xs">
            Building AI tools that make complex data simple and decisions faster.
          </p>
        </div>

        {/* Links grid */}
        <div className="grid grid-cols-3 gap-3">
          {links.map(({ icon, label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-2 p-4 rounded-[8px] bg-[#0f0f0f] border border-[#1e1e1e] hover:border-[#404040] hover:bg-[#1a1a1a] transition-all duration-150 cursor-pointer"
            >
              <span className="text-[#a3a3a3] group-hover:text-amber-400 transition-colors duration-150">
                {icon}
              </span>
              <span className="text-[11px] text-[#525252] font-medium">{label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
