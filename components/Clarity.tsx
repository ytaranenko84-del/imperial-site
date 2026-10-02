import Script from 'next/script'

/**
 * Microsoft Clarity — безкоштовний запис реальних сесій відвідувачів і
 * теплові карти. Вантажиться лише коли в налаштуваннях заповнено Project ID
 * — той самий принцип «немає значення — немає коду», що й з GA4.
 */

const CLARITY_ID = /^[a-z0-9]{6,20}$/i

export default function Clarity({ projectId }: { projectId: string }) {
  if (!CLARITY_ID.test(projectId)) return null

  return (
    <Script id="clarity-init" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "${projectId}");`}
    </Script>
  )
}
