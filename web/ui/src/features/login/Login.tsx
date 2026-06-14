import { useState, useCallback } from "react";
import { useGame } from "../../store/store";
import { bridge } from "../../bridge/useBridge";
import { Panel, Button } from "../../design/primitives";
import { EntryBackdrop } from "../entry/EntryBackdrop";

export function Login() {
  const loginResult = useGame((s) => s.loginResult);
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");

  const submit = useCallback(() => {
    if (account.trim()) {
      bridge.login(account.trim(), password);
    }
  }, [account, password]);

  const hasError = loginResult !== null && !loginResult.ok;
  const errorMsg = hasError
    ? loginResult!.reason.trim() || "Login failed. Please try again."
    : null;

  return (
    <EntryBackdrop>
      <Panel className="entry-card" style={{ maxWidth: 420 }}>
        <div className="entry-logo">
          <h1 className="entry-logo__title">MapleStory</h1>
          <p className="entry-logo__sub">Sign in to continue</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="entry-field">
            <label htmlFor="login-account">Account</label>
            <input
              id="login-account"
              className="entry-input"
              type="text"
              autoComplete="username"
              placeholder="Enter account name"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              data-testid="login-account"
            />
          </div>

          <div className="entry-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="entry-input"
              type="password"
              autoComplete="current-password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="login-password"
            />
          </div>

          {errorMsg && <div className="entry-error">{errorMsg}</div>}

          <div className="entry-actions">
            <Button
              onClick={() => {}}
              disabled={!account.trim()}
              testId="login-submit"
            >
              Log In
            </Button>
          </div>
        </form>
      </Panel>
    </EntryBackdrop>
  );
}
