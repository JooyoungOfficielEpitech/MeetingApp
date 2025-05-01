import React from 'react';
import styles from './Footer.module.css';

const Footer: React.FC = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className={styles.appFooter}>
            © {currentYear} Amié. All rights reserved.
        </footer>
    );
};

export default Footer; 