import React from "react";

export type IconName = "AddPlus" | "Appearance" | "Arrow" | "Attachment" | "Chats" | "Circle" | "ContactHeart" | "CopyText" | "Cross" | "Delete" | "Edit" | "File" | "Forward" | "Fullscreen" | "FullscreenExit" | "Language" | "Logout" | "Notification" | "Passkey" | "Pause" | "Photo" | "Play" | "Privacy" | "Read" | "Reply" | "SaveAs" | "Search" | "Select" | "Selfie" | "SendDestkop" | "SendMobile" | "Sessions" | "Sound" | "SoundMaxFill" | "SoundMinFill" | "SoundMuteFill" | "Unread" | "Video" | "Wallpaper" | "Spinner" | "ContactsAnimated";
export type IconProps = React.SVGProps<SVGSVGElement> & { name: IconName };


export const IconsSprite = () => (
  <svg style={{ display: "none" }} xmlns="http://www.w3.org/2000/svg">
    <symbol id="icon-AddPlus" viewBox="0 0 24 24"><title>Add-plus SVG Icon</title><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 12h6m0 0h6m-6 0v6m0-6V6"/></symbol>
    <symbol id="icon-Appearance" viewBox="0 0 16 16"><title>Appearance SVG Icon</title><path fill="currentColor" fillRule="evenodd" d="m14.489 8.388l-.001.006a.1.1 0 0 1-.027.028a.43.43 0 0 1-.264.082h-3.186c-3.118 0-4.68 3.77-2.476 5.974a6.5 6.5 0 1 1 5.953-6.09Zm-.292 1.616c.913 0 1.736-.618 1.79-1.529a8 8 0 1 0-7.032 7.468c1.243-.147 1.527-1.639.641-2.525c-1.26-1.26-.367-3.414 1.415-3.414zM10 5a1 1 0 1 1-2 0a1 1 0 0 1 2 0M6 7a1 1 0 1 0 0-2a1 1 0 0 0 0 2m0 2a1 1 0 1 1-2 0a1 1 0 0 1 2 0" clipRule="evenodd"/></symbol>
    <symbol id="icon-Arrow" viewBox="0 0 24 24"><title>Arrow-ios-forward-outline SVG Icon</title><path fill="currentColor" d="M10 19a1 1 0 0 1-.64-.23a1 1 0 0 1-.13-1.41L13.71 12L9.39 6.63a1 1 0 0 1 .15-1.41a1 1 0 0 1 1.46.15l4.83 6a1 1 0 0 1 0 1.27l-5 6A1 1 0 0 1 10 19"/></symbol>
    <symbol id="icon-Attachment" viewBox="0 0 24 24">
<path
    d="M20 10.9696L11.9628 18.5497C10.9782 19.4783 9.64274 20 8.25028 20C6.85782 20 5.52239 19.4783
                4.53777 18.5497C3.55315 17.6211 3 16.3616 3 15.0483C3 13.7351 3.55315 12.4756 4.53777 11.547L12.575
                3.96687C13.2314 3.34779 14.1217 3 15.05 3C15.9783 3 16.8686 3.34779 17.525 3.96687C18.1814 4.58595
                18.5502 5.4256 18.5502 6.30111C18.5502 7.17662 18.1814 8.01628 17.525 8.63535L9.47904 16.2154C9.15083
                16.525 8.70569 16.6989 8.24154 16.6989C7.77738 16.6989 7.33224 16.525 7.00403 16.2154C6.67583 15.9059
                6.49144 15.4861 6.49144 15.0483C6.49144 14.6106 6.67583 14.1907 7.00403 13.8812L14.429 6.88674"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
/>
</symbol>
    <symbol id="icon-Chats" viewBox="0 0 256 256"><path d="M232.07 186.76a80 80 0 0 0-62.5-114.17a80 80 0 1 0-145.64 66.17l-7.27 24.71a16 16 0 0 0 19.87 19.87l24.71-7.27a80.39 80.39 0 0 0 25.18 7.35a80 80 0 0 0 108.34 40.65l24.71 7.27a16 16 0 0 0 19.87-19.86Zm-16.25 1.47L224 216l-27.76-8.17a8 8 0 0 0-6 .63a64.05 64.05 0 0 1-85.87-24.88a79.93 79.93 0 0 0 70.33-93.87a64 64 0 0 1 41.75 92.48a8 8 0 0 0-.63 6.04"/></symbol>
    <symbol id="icon-Circle" viewBox="0 0 24 24"><title>Dummy-circle-small SVG Icon</title><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8"/></symbol>
    <symbol id="icon-ContactHeart" viewBox="0 0 2048 2048"><title>Contact-heart SVG Icon</title><path fill="currentColor" d="M2048 1484q0 54-20 102t-58 87l-370 369l-370-369q-38-38-58-86t-20-103t21-104t57-85t84-58t105-21q50 0 97 17t84 53q38-35 84-52t97-18q56 0 104 21t85 57t57 86t21 104m-128 0q0-29-11-54t-30-45t-44-30t-55-11q-57 0-98 41l-82 82l-82-82q-20-20-45-30t-53-11q-29 0-54 11t-45 30t-30 44t-11 55q0 57 41 98l279 279l279-279q41-41 41-98m-768-332q-87-65-181-96t-203-32q-134 0-251 49t-203 136t-136 204t-50 251H0q0-121 35-232t100-206t156-166t206-115q-55-34-99-82t-76-104t-49-119t-17-128q0-106 40-199t110-162T569 41T768 0t199 40t162 110t110 163t41 199q0 65-17 127t-48 119t-76 105t-100 82q66 23 121 58t109 82q-33 11-61 28t-56 39m0-640q0-79-30-148t-83-122t-122-83t-149-31q-79 0-148 30t-122 83t-83 122t-31 149q0 79 30 148t83 122t122 83t149 31q79 0 148-30t122-83t83-122t31-149"/></symbol>
    <symbol id="icon-CopyText" viewBox="0 0 24 24"><title>Copy SVG Icon</title><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><path d="M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.242a2 2 0 0 0-.602-1.43L16.083 2.57A2 2 0 0 0 14.685 2H10a2 2 0 0 0-2 2"/><path d="M16 18v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2"/></g></symbol>
    <symbol id="icon-Cross" viewBox="0 0 24 24"><title>Cross SVG Icon</title><path fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="M20 20L4 4m16 0L4 20"/></symbol>
    <symbol id="icon-Delete" viewBox="0 0 16 16"><title>Delete-16-regular SVG Icon</title><path fill="currentColor" d="M7 3h2a1 1 0 0 0-2 0M6 3a2 2 0 1 1 4 0h4a.5.5 0 0 1 0 1h-.564l-1.205 8.838A2.5 2.5 0 0 1 9.754 15H6.246a2.5 2.5 0 0 1-2.477-2.162L2.564 4H2a.5.5 0 0 1 0-1zm1 3.5a.5.5 0 0 0-1 0v5a.5.5 0 0 0 1 0zM9.5 6a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-1 0v-5a.5.5 0 0 1 .5-.5m-4.74 6.703A1.5 1.5 0 0 0 6.246 14h3.508a1.5 1.5 0 0 0 1.487-1.297L12.427 4H3.573z"/></symbol>
    <symbol id="icon-Edit" viewBox="0 0 24 24"><title>Edit SVG Icon</title><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><path d="m16.475 5.408l2.117 2.117m-.756-3.982L12.109 9.27a2.118 2.118 0 0 0-.58 1.082L11 13l2.648-.53c.41-.082.786-.283 1.082-.579l5.727-5.727a1.853 1.853 0 1 0-2.621-2.621"/><path d="M19 15v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3"/></g></symbol>
    <symbol id="icon-File" viewBox="0 0 24 24"><title>File SVG Icon</title><g fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"><path strokeLinecap="round" d="M4 4v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.342a2 2 0 0 0-.602-1.43l-4.44-4.342A2 2 0 0 0 13.56 2H6a2 2 0 0 0-2 2m5 9h6m-6 4h3"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></g></symbol>
    <symbol id="icon-Forward" viewBox="0 0 24 24"><title>Arrow-forward-thick SVG Icon</title><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m22 11l-7-9v5C3.047 7 1.668 16.678 2 22c.502-2.685.735-7 13-7v5z"/></symbol>
    <symbol id="icon-Fullscreen" viewBox="0 0 512 512"><title>Fullscreen SVG Icon</title><path fill="currentColor" d="M208 48V16H16v192h32V70.627l160.687 160.686l22.626-22.626L70.627 48zm256 256v137.373L299.313 276.687l-22.626 22.626L441.373 464H304v32h192V304z"/></symbol>
    <symbol id="icon-FullscreenExit" viewBox="0 0 512 512"><title>Fullscreen-exit SVG Icon</title><path fill="currentColor" d="M204 181.372L38.628 16H16v22.628L181.372 204H44v32h192V44h-32zM326.628 304H464v-32H272v192h32V326.628L473.372 496H496v-22.628z"/></symbol>
    <symbol id="icon-Language" viewBox="0 0 24 24"><title>Language SVG Icon</title><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138A47.63 47.63 0 0 1 15 5.621m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802"/></symbol>
    <symbol id="icon-Logout" viewBox="0 0 24 24"><title>Logout SVG Icon</title><g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5"><path strokeLinejoin="round" d="M13.477 21.245H8.34a4.918 4.918 0 0 1-5.136-4.623V7.378A4.918 4.918 0 0 1 8.34 2.755h5.136"/><path strokeMiterlimit="10" d="M20.795 12H7.442"/><path strokeLinejoin="round" d="m16.083 17.136l4.404-4.404a1.04 1.04 0 0 0 0-1.464l-4.404-4.404"/></g></symbol>
    <symbol id="icon-Notification" viewBox="0 0 24 24"><title>Notification-on-outline SVG Icon</title><path fill="currentColor" d="M6.429 2.413a.75.75 0 0 0-1.13-.986l-1.292 1.48a4.75 4.75 0 0 0-1.17 3.024L2.78 8.65a.75.75 0 1 0 1.5.031l.056-2.718a3.25 3.25 0 0 1 .801-2.069z"/><path fill="currentColor" fillRule="evenodd" d="M6.237 7.7a4.214 4.214 0 0 1 4.206-3.95H11V3a1 1 0 1 1 2 0v.75h.557a4.214 4.214 0 0 1 4.206 3.95l.221 3.534a7.376 7.376 0 0 0 1.308 3.754a1.617 1.617 0 0 1-1.135 2.529l-3.407.408V19a2.75 2.75 0 1 1-5.5 0v-1.075l-3.407-.409a1.617 1.617 0 0 1-1.135-2.528a7.377 7.377 0 0 0 1.308-3.754zm4.206-2.45a2.714 2.714 0 0 0-2.709 2.544l-.22 3.534a8.877 8.877 0 0 1-1.574 4.516a.117.117 0 0 0 .082.183l3.737.449c1.489.178 2.993.178 4.482 0l3.737-.449a.117.117 0 0 0 .082-.183a8.876 8.876 0 0 1-1.573-4.516l-.221-3.534a2.714 2.714 0 0 0-2.709-2.544zm1.557 15c-.69 0-1.25-.56-1.25-1.25v-.75h2.5V19c0 .69-.56 1.25-1.25 1.25" clipRule="evenodd"/><path fill="currentColor" d="M17.643 1.355a.75.75 0 0 0-.072 1.058l1.292 1.48a3.25 3.25 0 0 1 .8 2.07l.057 2.717a.75.75 0 0 0 1.5-.031l-.057-2.718a4.75 4.75 0 0 0-1.17-3.024l-1.292-1.48a.75.75 0 0 0-1.058-.072"/></symbol>
    <symbol id="icon-Passkey" viewBox="0 0 20 21"><title>Person-passkey-20-regular SVG Icon</title><path fill="currentColor" d="M10 2a4 4 0 1 0 0 8a4 4 0 0 0 0-8M7 6a3 3 0 1 1 6 0a3 3 0 0 1-6 0m-1.991 5A2 2 0 0 0 3 13c0 1.691.833 2.966 2.135 3.797C6.417 17.614 8.145 18 10 18s3.583-.386 4.865-1.203q.143-.091.278-.19v-1.33a4 4 0 0 1-.816.676C13.257 16.636 11.735 17 10 17s-3.257-.364-4.327-1.047C4.623 15.283 4 14.31 4 13c0-.553.448-1 1.009-1h8.264a4 4 0 0 1-.13-1zm8.99 0a3 3 0 0 0 1.917 2.798l.084.031v5.029c0 .1.035.196.098.272l.599.728c.162.197.459.21.637.028l1.534-1.565a.43.43 0 0 0-.02-.62L17.5 16.5l1.351-1.177a.43.43 0 0 0 0-.646l-.939-.818A3.001 3.001 0 0 0 17 8a3 3 0 0 0-3 3m4-1a1 1 0 1 1-2 0a1 1 0 0 1 2 0"/></symbol>
    <symbol id="icon-Pause" viewBox="0 0 24 24"><title>Pause SVG Icon</title><path fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="M7 5v14M17 5v14"/></symbol>
    <symbol id="icon-Photo" viewBox="0 0 24 24"><title>Image SVG Icon</title><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><path d="M2 6a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"/><circle cx="8.5" cy="8.5" r="2.5"/><path d="M14.526 12.621L6 22h12.133A3.867 3.867 0 0 0 22 18.133V18c0-.466-.175-.645-.49-.99l-4.03-4.395a2 2 0 0 0-2.954.006"/></g></symbol>
    <symbol id="icon-Play" viewBox="0 0 24 24"><title>Play SVG Icon</title><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 4v16m14-8L6 20m14-8L6 4"/></symbol>
    <symbol id="icon-Privacy" viewBox="0 0 24 24"><title>Privacy-tip-outline-rounded SVG Icon</title><path fill="currentColor" d="M12 16.23q.213 0 .357-.143t.143-.356v-4.654q0-.213-.144-.356q-.144-.144-.357-.144t-.356.144t-.143.356v4.654q0 .212.144.356t.357.144M12 9q.262 0 .438-.177q.177-.177.177-.438t-.177-.439T12 7.77t-.438.177t-.177.439t.177.438T12 9m0 11.842q-.137 0-.287-.025t-.28-.075Q8.48 19.617 6.74 16.926T5 11.1V6.817q0-.514.293-.926t.757-.597l5.385-2q.292-.106.565-.106t.565.106l5.385 2q.464.185.757.597t.293.926V11.1q0 3.135-1.74 5.826t-4.692 3.816q-.131.05-.281.075t-.287.025m0-.942q2.6-.825 4.3-3.3t1.7-5.5V6.798q0-.192-.106-.346t-.298-.23l-5.384-2q-.097-.04-.212-.04t-.212.04l-5.384 2q-.192.076-.298.23T6 6.798V11.1q0 3.025 1.7 5.5t4.3 3.3m0-7.862"/></symbol>
    <symbol id="icon-Read" viewBox="0 0 16 11"><title>msg-dblcheck</title><path d="M11.0714 0.652832C10.991 0.585124 10.8894 0.55127 10.7667 0.55127C10.6186 0.55127 10.4916 0.610514 10.3858 0.729004L4.19688 8.36523L1.79112 6.09277C1.7488 6.04622 1.69802 6.01025 1.63877 5.98486C1.57953 5.95947 1.51817 5.94678 1.45469 5.94678C1.32351 5.94678 1.20925 5.99544 1.11192 6.09277L0.800883 6.40381C0.707784 6.49268 0.661235 6.60482 0.661235 6.74023C0.661235 6.87565 0.707784 6.98991 0.800883 7.08301L3.79698 10.0791C3.94509 10.2145 4.11224 10.2822 4.29844 10.2822C4.40424 10.2822 4.5058 10.259 4.60313 10.2124C4.70046 10.1659 4.78086 10.1003 4.84434 10.0156L11.4903 1.59863C11.5623 1.5013 11.5982 1.40186 11.5982 1.30029C11.5982 1.14372 11.5348 1.01888 11.4078 0.925781L11.0714 0.652832ZM8.6212 8.32715C8.43077 8.20866 8.2488 8.09017 8.0753 7.97168C7.99489 7.89128 7.8891 7.85107 7.75791 7.85107C7.6098 7.85107 7.4892 7.90397 7.3961 8.00977L7.10411 8.33984C7.01947 8.43717 6.97715 8.54508 6.97715 8.66357C6.97715 8.79476 7.0237 8.90902 7.1168 9.00635L8.1959 10.0791C8.33132 10.2145 8.49636 10.2822 8.69102 10.2822C8.79681 10.2822 8.89838 10.259 8.99571 10.2124C9.09304 10.1659 9.17556 10.1003 9.24327 10.0156L15.8639 1.62402C15.9358 1.53939 15.9718 1.43994 15.9718 1.32568C15.9718 1.1818 15.9125 1.05697 15.794 0.951172L15.4386 0.678223C15.3582 0.610514 15.2587 0.57666 15.1402 0.57666C14.9964 0.57666 14.8715 0.635905 14.7657 0.754395L8.6212 8.32715Z"></path></symbol>
    <symbol id="icon-Reply" viewBox="0 0 24 24"><title>Reply SVG Icon</title><g fill="none"><path d="M2 10.981L8.973 2v4.99c11.952 0 13.316 9.688 12.984 15.01l-.007-.041c-.502-2.685-.712-6.986-12.977-6.986v4.99L2 10.98z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></g></symbol>
    <symbol id="icon-SaveAs" viewBox="0 0 24 24"><title>Download SVG Icon</title><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17"/></symbol>
    <symbol id="icon-Search" viewBox="0 0 17 48"><path d="m16.2294 29.9556-4.1755-4.0821a6.4711 6.4711 0 1 0 -1.2839 1.2625l4.2005 4.1066a.9.9 0 1 0 1.2588-1.287zm-14.5294-8.0017a5.2455 5.2455 0 1 1 5.2455 5.2527 5.2549 5.2549 0 0 1 -5.2455-5.2527z"/></symbol>
    <symbol id="icon-Select" viewBox="0 0 24 24"><title>Circle-check SVG Icon</title><g fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m8 12.5l3 3l5-6"/><circle cx="12" cy="12" r="10"/></g></symbol>
    <symbol id="icon-Selfie" viewBox="0 0 24 24">
  <path d="M3,9A1,1,0,0,0,4,8V5A1,1,0,0,1,5,4H8A1,1,0,0,0,8,2H5A3,3,0,0,0,2,5V8A1,1,0,0,0,3,9ZM8,20H5a1,1,0,0,1-1-1V16a1,1,0,0,0-2,0v3a3,3,0,0,0,3,3H8a1,1,0,0,0,0-2ZM12,8a4,4,0,1,0,4,4A4,4,0,0,0,12,8Zm0,6a2,2,0,1,1,2-2A2,2,0,0,1,12,14ZM19,2H16a1,1,0,0,0,0,2h3a1,1,0,0,1,1,1V8a1,1,0,0,0,2,0V5A3,3,0,0,0,19,2Zm2,13a1,1,0,0,0-1,1v3a1,1,0,0,1-1,1H16a1,1,0,0,0,0,2h3a3,3,0,0,0,3-3V16A1,1,0,0,0,21,15Z"></path>
</symbol>
    <symbol id="icon-SendDestkop" viewBox="0 0 24 24">
<path
    d="M21.66,12a2,2,0,0,1-1.14,1.81L5.87,20.75A2.08,2.08,0,0,1,5,21a2,2,0,0,1-1.82-2.82L5.46,13H11a1,1,0,0,0,0-2H5.46L3.18,5.87A2,2,0,0,1,5.86,3.25h0l14.65,6.94A2,2,0,0,1,21.66,12Z"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
/>
</symbol>
    <symbol id="icon-SendMobile" viewBox="0 0 24 24">
    <path fill="none" strokeWidth="1.5" d="m6.998 10.247l.435.76c.277.485.415.727.415.993s-.138.508-.415.992l-.435.761c-1.238 2.167-1.857 3.25-1.375 3.788c.483.537 1.627.037 3.913-.963l6.276-2.746c1.795-.785 2.693-1.178 2.693-1.832c0-.654-.898-1.047-2.693-1.832L9.536 7.422c-2.286-1-3.43-1.5-3.913-.963c-.482.537.137 1.62 1.375 3.788Z"/>
</symbol>
    <symbol id="icon-Sessions" viewBox="0 0 24 24"><title>Devices SVG Icon</title><path fill="currentColor" d="M20 3H7c-1.103 0-2 .897-2 2v2H4c-1.103 0-2 .897-2 2v10c0 1.103.897 2 2 2h6c1.103 0 2-.897 2-2h8c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2M9.997 19H4V9h6zm10-2H12V9c0-1.103-.897-2-2-2H7V5h13z"/></symbol>
    <symbol id="icon-Sound" viewBox="0 0 24 24"><title>Sound SVG Icon</title><path fill="none" stroke="currentColor" strokeWidth="2" d="M13 14H8.818a3.249 3.249 0 1 0 .403 6.472l.557-.07A3.678 3.678 0 0 0 13 16.754V7.39c0-1.619 0-2.428.474-2.987c.474-.56 1.272-.693 2.868-.96L18.7 3.05c.136-.022.204-.034.24.006c.037.04.02.106-.013.24l-.895 3.581c-.015.06-.023.09-.044.11c-.02.02-.05.026-.111.038L13 8"/></symbol>
    <symbol id="icon-SoundMaxFill" viewBox="0 0 24 24"><title>Sound-max-fill SVG Icon</title><g fill="none"><path fill="#ffffff" d="M4.158 13.93a3.752 3.752 0 0 1 0-3.86a1.5 1.5 0 0 1 .993-.7l1.693-.339a.45.45 0 0 0 .258-.153L9.17 6.395c1.182-1.42 1.774-2.129 2.301-1.938C12 4.648 12 5.572 12 7.42v9.162c0 1.847 0 2.77-.528 2.962c-.527.19-1.119-.519-2.301-1.938L7.1 15.122a.45.45 0 0 0-.257-.153L5.15 14.63a1.5 1.5 0 0 1-.993-.7"/><path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="M14.536 8.464a5 5 0 0 1 .027 7.044m4.094-9.165a8 8 0 0 1 .044 11.27"/></g></symbol>
    <symbol id="icon-SoundMinFill" viewBox="0 0 24 24"><title>Sound-min-fill SVG Icon</title><g fill="none"><path fill="#ffffff" d="M4.158 13.93a3.752 3.752 0 0 1 0-3.86a1.5 1.5 0 0 1 .993-.7l1.693-.339a.45.45 0 0 0 .258-.153L9.17 6.395c1.182-1.42 1.774-2.129 2.301-1.938C12 4.648 12 5.572 12 7.42v9.162c0 1.847 0 2.77-.528 2.962c-.527.19-1.119-.519-2.301-1.938L7.1 15.122a.45.45 0 0 0-.257-.153L5.15 14.63a1.5 1.5 0 0 1-.993-.7"/><path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="M14.536 8.464a5 5 0 0 1 .027 7.044"/></g></symbol>
    <symbol id="icon-SoundMuteFill" viewBox="0 0 24 24"><title>Sound-mute-fill SVG Icon</title><g fill="none"><path fill="#ffffff" d="M4.158 13.93a3.752 3.752 0 0 1 0-3.86a1.5 1.5 0 0 1 .993-.7l1.693-.339a.45.45 0 0 0 .258-.153L9.17 6.395c1.182-1.42 1.774-2.129 2.301-1.938C12 4.648 12 5.572 12 7.42v9.162c0 1.847 0 2.77-.528 2.962c-.527.19-1.119-.519-2.301-1.938L7.1 15.122a.45.45 0 0 0-.257-.153L5.15 14.63a1.5 1.5 0 0 1-.993-.7"/><path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="m15 15l6-6m0 6l-6-6"/></g></symbol>
    <symbol id="icon-Unread" viewBox="0 0 12 11"><title>msg-check</title><path d="M11.1549 0.652832C11.0745 0.585124 10.9729 0.55127 10.8502 0.55127C10.7021 0.55127 10.5751 0.610514 10.4693 0.729004L4.28038 8.36523L1.87461 6.09277C1.8323 6.04622 1.78151 6.01025 1.72227 5.98486C1.66303 5.95947 1.60166 5.94678 1.53819 5.94678C1.407 5.94678 1.29275 5.99544 1.19541 6.09277L0.884379 6.40381C0.79128 6.49268 0.744731 6.60482 0.744731 6.74023C0.744731 6.87565 0.79128 6.98991 0.884379 7.08301L3.88047 10.0791C4.02859 10.2145 4.19574 10.2822 4.38194 10.2822C4.48773 10.2822 4.58929 10.259 4.68663 10.2124C4.78396 10.1659 4.86436 10.1003 4.92784 10.0156L11.5738 1.59863C11.6458 1.5013 11.6817 1.40186 11.6817 1.30029C11.6817 1.14372 11.6183 1.01888 11.4913 0.925781L11.1549 0.652832Z"></path></symbol>
    <symbol id="icon-Video" viewBox="0 0 24 24"><title>Video SVG Icon</title><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><rect width="20" height="16" x="2" y="4" rx="4"/><path d="m15 12l-5-3v6z"/></g></symbol>
    <symbol id="icon-Wallpaper" viewBox="0 0 20 20"><title>Wallpaper-20-regular SVG Icon</title><path fill="#ffffff" d="M3 6a3 3 0 0 1 3-3h2.5a.5.5 0 0 1 0 1H6a2 2 0 0 0-2 2v2.5a.5.5 0 0 1-1 0zm8-2.5a.5.5 0 0 1 .5-.5H14a3 3 0 0 1 3 3v2.5a.5.5 0 0 1-1 0V6a2 2 0 0 0-2-2h-2.5a.5.5 0 0 1-.5-.5M3.5 11a.5.5 0 0 1 .5.5V14c0 .37.101.718.277 1.016l4.486-4.486a1.75 1.75 0 0 1 2.474 0l4.486 4.486C15.9 14.718 16 14.371 16 14v-2.5a.5.5 0 0 1 1 0V14a3 3 0 0 1-3 3h-2.5a.5.5 0 0 1 0-1H14c.37 0 .718-.101 1.016-.277l-4.486-4.486a.75.75 0 0 0-1.06 0l-4.486 4.486C5.282 15.9 5.629 16 6 16h2.5a.5.5 0 0 1 0 1H6a3 3 0 0 1-3-3v-2.5a.5.5 0 0 1 .5-.5m9-4a.5.5 0 1 0 0 1a.5.5 0 0 0 0-1m-1.5.5a1.5 1.5 0 1 1 3 0a1.5 1.5 0 0 1-3 0"/></symbol>
  </svg>
);

const staticViewBoxes: Record<string, string> = {
  "AddPlus": "0 0 24 24",
  "Appearance": "0 0 16 16",
  "Arrow": "0 0 24 24",
  "Attachment": "0 0 24 24",
  "Chats": "0 0 256 256",
  "Circle": "0 0 24 24",
  "ContactHeart": "0 0 2048 2048",
  "CopyText": "0 0 24 24",
  "Cross": "0 0 24 24",
  "Delete": "0 0 16 16",
  "Edit": "0 0 24 24",
  "File": "0 0 24 24",
  "Forward": "0 0 24 24",
  "Fullscreen": "0 0 512 512",
  "FullscreenExit": "0 0 512 512",
  "Language": "0 0 24 24",
  "Logout": "0 0 24 24",
  "Notification": "0 0 24 24",
  "Passkey": "0 0 20 21",
  "Pause": "0 0 24 24",
  "Photo": "0 0 24 24",
  "Play": "0 0 24 24",
  "Privacy": "0 0 24 24",
  "Read": "0 0 16 11",
  "Reply": "0 0 24 24",
  "SaveAs": "0 0 24 24",
  "Search": "0 0 17 48",
  "Select": "0 0 24 24",
  "Selfie": "0 0 24 24",
  "SendDestkop": "0 0 24 24",
  "SendMobile": "0 0 24 24",
  "Sessions": "0 0 24 24",
  "Sound": "0 0 24 24",
  "SoundMaxFill": "0 0 24 24",
  "SoundMinFill": "0 0 24 24",
  "SoundMuteFill": "0 0 24 24",
  "Unread": "0 0 12 11",
  "Video": "0 0 24 24",
  "Wallpaper": "0 0 20 20"
};


export const Icon: React.FC<IconProps> = ({ name, ...props }) => {
  const animated = {"Spinner":{"inner":"<radialGradient id='a12' cx='.66' fx='.66' cy='.3125' fy='.3125' gradientTransform='scale(1.5)'><stop offset='0' stop-color='#FFFFFF'></stop><stop offset='.3' stop-color='#FFFFFF' stop-opacity='.9'></stop><stop offset='.6' stop-color='#FFFFFF' stop-opacity='.6'></stop><stop offset='.8' stop-color='#FFFFFF' stop-opacity='.3'></stop><stop offset='1' stop-color='#FFFFFF' stop-opacity='0'></stop></radialGradient><circle transform-origin='center' fill='none' stroke='url(#a12)' stroke-width='15' stroke-linecap='round' stroke-dasharray='200 1000' stroke-dashoffset='0' cx='100' cy='100' r='70'><animateTransform type='rotate' attributeName='transform' calcMode='spline' dur='1' values='360;0' keyTimes='0;1' keySplines='0 0 1 1' repeatCount='indefinite'></animateTransform></circle><circle transform-origin='center' fill='none' opacity='.2' stroke='#FFFFFF' stroke-width='15' stroke-linecap='round' cx='100' cy='100' r='70'></circle>","viewBox":"0 0 200 200"},"ContactsAnimated":{"inner":"\n  <path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\" />\n  <circle cx=\"9\" cy=\"7\" r=\"4\" />\n  <path d=\"M22 21v-2a4 4 0 0 0-3-3.87\">\n    <animateTransform\n      attributeName=\"transform\"\n      type=\"translate\"\n      values=\"-6 0; 0 0\"\n      dur=\"420ms\"\n      begin=\"0s\"\n      calcMode=\"spline\"\n      keyTimes=\"0;1\"\n      keySplines=\"0.25 0.46 0.45 0.94\"\n    />\n  </path>\n  <path d=\"M16 3.13a4 4 0 0 1 0 7.75\">\n    <animateTransform\n      attributeName=\"transform\"\n      type=\"translate\"\n      values=\"-6 0; 0 0\"\n      dur=\"420ms\"\n      begin=\"0s\"\n      calcMode=\"spline\"\n      keyTimes=\"0;1\"\n      keySplines=\"0.25 0.46 0.45 0.94\"\n    />\n  </path>\n","viewBox":"0 0 24 24"}}[name];
  if (animated) {
    return (
      <svg viewBox={animated.viewBox} {...props}>
        <g dangerouslySetInnerHTML={{ __html: animated.inner }} />
      </svg>
    );
  }
  

  return <svg viewBox={staticViewBoxes[name]} {...props}><use href={`#icon-${name}`} /></svg>;
};

