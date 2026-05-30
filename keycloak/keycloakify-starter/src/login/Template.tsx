import { useEffect } from "react";
import { clsx } from "keycloakify/tools/clsx";
import { kcSanitize } from "keycloakify/lib/kcSanitize";
import type { TemplateProps } from "keycloakify/login/TemplateProps";
import { getKcClsx } from "keycloakify/login/lib/kcClsx";
import { useSetClassName } from "keycloakify/tools/useSetClassName";
import { useInitialize } from "keycloakify/login/Template.useInitialize";
import type { I18n } from "./i18n";
import type { KcContext } from "./KcContext";
import "./login.css";

export default function Template(props: TemplateProps<KcContext, I18n>) {
    const {
        displayInfo = false,
        displayMessage = true,
        displayRequiredFields = false,
        headerNode,
        socialProvidersNode = null,
        infoNode = null,
        documentTitle,
        bodyClassName,
        kcContext,
        i18n,
        doUseDefaultCss,
        classes,
        children
    } = props;

    const { kcClsx } = getKcClsx({ doUseDefaultCss, classes });

    const { msg, msgStr, currentLanguage, enabledLanguages } = i18n;
    const { realm, auth, url, message, isAppInitiatedAction } = kcContext;

    useEffect(() => {
        document.title = documentTitle ?? msgStr("loginTitle", realm.displayName || realm.name);
    }, []);

    useSetClassName({
        qualifiedName: "html",
        className: clsx(kcClsx("kcHtmlClass"), "kc-modern-html")
    });

    useSetClassName({
        qualifiedName: "body",
        className: clsx(bodyClassName ?? kcClsx("kcBodyClass"), "kc-modern-body")
    });

    const { isReadyToRender } = useInitialize({ kcContext, doUseDefaultCss });

    if (!isReadyToRender) {
        return null;
    }

    return (
        <div className={clsx(kcClsx("kcLoginClass"), "kc-modern-shell")}>
            <main className="kc-modern-card">
                <div className="kc-modern-card__top">
                    <div className="kc-modern-brand" aria-hidden="true">
                        K
                    </div>
                    {enabledLanguages.length > 1 && (
                        <div className={kcClsx("kcLocaleMainClass")} id="kc-locale">
                            <div id="kc-locale-wrapper" className={kcClsx("kcLocaleWrapperClass")}>
                                <div id="kc-locale-dropdown" className={clsx("menu-button-links", kcClsx("kcLocaleDropDownClass"))}>
                                    <button
                                        tabIndex={1}
                                        id="kc-current-locale-link"
                                        aria-label={msgStr("languages")}
                                        aria-haspopup="true"
                                        aria-expanded="false"
                                        aria-controls="language-switch1"
                                        className="kc-modern-locale"
                                    >
                                        {currentLanguage.label}
                                    </button>
                                    <ul
                                        role="menu"
                                        tabIndex={-1}
                                        aria-labelledby="kc-current-locale-link"
                                        aria-activedescendant=""
                                        id="language-switch1"
                                        className={kcClsx("kcLocaleListClass")}
                                    >
                                        {enabledLanguages.map(({ languageTag, label, href }, i) => (
                                            <li key={languageTag} className={kcClsx("kcLocaleListItemClass")} role="none">
                                                <a role="menuitem" id={`language-${i + 1}`} className={kcClsx("kcLocaleItemClass")} href={href}>
                                                    {label}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <header className="kc-modern-header">
                    {(() => {
                        const node = !(auth !== undefined && auth.showUsername && !auth.showResetCredentials) ? (
                            <h1 id="kc-page-title" className="kc-modern-title">
                                {headerNode}
                            </h1>
                        ) : (
                            <div id="kc-username" className={kcClsx("kcFormGroupClass")}>
                                <label id="kc-attempted-username" className="kc-modern-attempted-username">
                                    {auth.attemptedUsername}
                                </label>
                                <a id="reset-login" href={url.loginRestartFlowUrl} aria-label={msgStr("restartLoginTooltip")}>
                                    <div className="kc-login-tooltip">
                                        <i className={kcClsx("kcResetFlowIcon")}></i>
                                        <span className="kc-tooltip-text">{msg("restartLoginTooltip")}</span>
                                    </div>
                                </a>
                            </div>
                        );

                        if (displayRequiredFields) {
                            return (
                                <div className={kcClsx("kcContentWrapperClass")}>
                                    <div className={clsx(kcClsx("kcLabelWrapperClass"), "subtitle")}>
                                        <span className="subtitle">
                                            <span className="required">*</span>
                                            {msg("requiredFields")}
                                        </span>
                                    </div>
                                    <div className="col-md-10">{node}</div>
                                </div>
                            );
                        }

                        return node;
                    })()}
                    <p className="kc-modern-subtitle">A clean sign-in experience for your Keycloak realm.</p>
                </header>

                <section className="kc-modern-content">
                    {displayMessage && message !== undefined && (message.type !== "warning" || !isAppInitiatedAction) && (
                        <div
                            className={clsx(
                                `alert-${message.type}`,
                                kcClsx("kcAlertClass"),
                                `pf-m-${message?.type === "error" ? "danger" : message.type}`,
                                "kc-modern-alert"
                            )}
                        >
                            <div className="pf-c-alert__icon">
                                {message.type === "success" && <span className={kcClsx("kcFeedbackSuccessIcon")}></span>}
                                {message.type === "warning" && <span className={kcClsx("kcFeedbackWarningIcon")}></span>}
                                {message.type === "error" && <span className={kcClsx("kcFeedbackErrorIcon")}></span>}
                                {message.type === "info" && <span className={kcClsx("kcFeedbackInfoIcon")}></span>}
                            </div>
                            <span
                                className={kcClsx("kcAlertTitleClass")}
                                dangerouslySetInnerHTML={{
                                    __html: kcSanitize(message.summary)
                                }}
                            />
                        </div>
                    )}

                    <div className="kc-modern-form">{children}</div>

                    {auth !== undefined && auth.showTryAnotherWayLink && (
                        <form id="kc-select-try-another-way-form" action={url.loginAction} method="post">
                            <div className={kcClsx("kcFormGroupClass")}>
                                <input type="hidden" name="tryAnotherWay" value="on" />
                                <a
                                    href="#"
                                    id="try-another-way"
                                    className="kc-modern-link"
                                    onClick={event => {
                                        document.forms["kc-select-try-another-way-form" as never].requestSubmit();
                                        event.preventDefault();
                                        return false;
                                    }}
                                >
                                    {msg("doTryAnotherWay")}
                                </a>
                            </div>
                        </form>
                    )}

                    {socialProvidersNode}
                </section>

                {displayInfo && infoNode && <footer className="kc-modern-footer">{infoNode}</footer>}
            </main>
        </div>
    );
}
