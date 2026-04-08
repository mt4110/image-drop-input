import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

export function ImageGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3.5" />
      <circle cx="8.5" cy="9" r="1.5" fill="currentColor" stroke="none" />
      <path d="M5.5 16.5 10.5 11.5 13.5 14.5 16 12l2.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ExpandGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M9 4.75H4.75V9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4.75 4.75 5 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 19.25h4.25V15" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m19.25 19.25-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BrowseGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M12 15.25v-7.5" strokeLinecap="round" />
      <path d="m8.75 11.25 3.25-3.5 3.25 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M6.25 18.25h11.5a1.75 1.75 0 0 0 1.75-1.75v-.5A2.75 2.75 0 0 0 16.75 13.25h-.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.25 13.25h-.5A2.75 2.75 0 0 0 4 16v.5a1.75 1.75 0 0 0 1.75 1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RemoveGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M5 7.75h14" strokeLinecap="round" />
      <path d="M9.25 7.75V6a1.75 1.75 0 0 1 1.75-1.75h2a1.75 1.75 0 0 1 1.75 1.75v1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m8.5 10.5.5 7.25a1.5 1.5 0 0 0 1.5 1.39h2.99a1.5 1.5 0 0 0 1.5-1.39l.51-7.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="m7 7 10 10M17 7 7 17" strokeLinecap="round" />
    </svg>
  );
}

export function SpinnerGlyph(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
