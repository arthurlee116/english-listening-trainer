#!/usr/bin/expect -f

set SERVER "ubuntu@49.234.30.246"
set PASSWORD "Abcd.1234"
set COMMAND [lindex $argv 0]

spawn ssh $SERVER "$COMMAND"
expect {
    "*password*:" {
        send "$PASSWORD\r"
        expect eof
    }
    "*yes/no*" {
        send "yes\r"
        expect "*password*:"
        send "$PASSWORD\r"
        expect eof
    }
    eof { exit }
}