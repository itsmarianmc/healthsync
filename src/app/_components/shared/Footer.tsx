export default function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer>
            <p>TUTTO È POSSIBILE</p>
            <p>
                <a href="https://contact.itsmarian.dev/">Contact</a>
                {' • '}
                <a href="https://itsmarian.dev/legal/cookies">Cookies</a>
                {' • '}
                <a href="https://itsmarian.dev/legal/privacy">Privacy Policy</a>
                {' • '}
                <a href="https://itsmarian.dev/legal/terms">Terms of Use</a>
            </p>
            <p className="change-settings">Change Cookie Preferences</p>
            <p style={{ marginTop: 'calc(1rem - 7.5px)' }}>
                © {year} itsmarian | All rights reserved!
            </p>
            <p>Made with ❤️ in Germany</p>
        </footer>
    );
}
