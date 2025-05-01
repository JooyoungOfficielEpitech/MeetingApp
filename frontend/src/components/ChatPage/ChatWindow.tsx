import React, { useState, ChangeEvent, FormEvent } from 'react';
import styles from './ChatWindow.module.css';
// Import strings
import * as AppStrings from '../../constants/strings';

// Mock messages
const mockMessages = [
    { id: 1, sender: 'other', text: '안녕하세요! 만나서 반가워요.' },
    { id: 2, sender: 'me', text: '네, 안녕하세요! 저도 반갑습니다.' },
    { id: 3, sender: 'other', text: '사진 잘 봤어요 :) 분위기 있으시네요.' },
    { id: 4, sender: 'me', text: '감사합니다 ㅎㅎ' },
];

const ChatWindow: React.FC = () => {
    const [messages, setMessages] = useState(mockMessages);
    const [newMessage, setNewMessage] = useState('');

    const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        setNewMessage(event.target.value);
    };

    const handleSendMessage = (event: FormEvent) => {
        event.preventDefault();
        if (newMessage.trim() === '') return;

        const nextId = messages.length > 0 ? messages[messages.length - 1].id + 1 : 1;
        const messageToSend = {
            id: nextId,
            sender: 'me', // Assume message sent is always from 'me'
            text: newMessage,
        };

        setMessages([...messages, messageToSend]);
        setNewMessage('');
        // Add logic to actually send message to backend later
        console.log('Sending message:', messageToSend);
    };

    return (
        <div className={styles.chatWindow}>
            <div className={styles.messageList}>
                {messages.map((msg) => (
                    <div key={msg.id} className={`${styles.messageBubble} ${msg.sender === 'me' ? styles.myMessage : styles.otherMessage}`}>
                        {msg.text}
                    </div>
                ))}
                 {/* Add scroll anchoring logic later */}
            </div>
            <form onSubmit={handleSendMessage} className={styles.messageInputForm}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={handleInputChange}
                    placeholder={AppStrings.CHATWINDOW_INPUT_PLACEHOLDER}
                    className={styles.messageInput}
                />
                <button type="submit" className={styles.sendButton}>{AppStrings.CHATWINDOW_SEND_BUTTON}</button>
            </form>
        </div>
    );
};

export default ChatWindow; 