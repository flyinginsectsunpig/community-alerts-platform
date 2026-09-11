package com.communityalerts.api.support;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

class ClientIpTest {

    @Test
    @DisplayName("a single forwarded entry is the client address")
    void singleForwardedEntry() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(ClientIp.HEADER, "203.0.113.7");

        assertThat(ClientIp.of(request)).isEqualTo("203.0.113.7");
    }

    @Test
    @DisplayName("only the rightmost entry is trusted; a caller-supplied prefix is ignored")
    void rightmostEntryWins() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(ClientIp.HEADER, "198.51.100.9, 10.0.0.1, 203.0.113.7");

        assertThat(ClientIp.of(request)).isEqualTo("203.0.113.7");
    }

    @Test
    @DisplayName("without the forwarded header the connection address is used")
    void fallsBackToRemoteAddress() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("192.0.2.55");

        assertThat(ClientIp.of(request)).isEqualTo("192.0.2.55");
    }

    @Test
    @DisplayName("a blank or truncated forwarded header falls back to the connection address")
    void blankForwardedHeaderFallsBack() {
        MockHttpServletRequest blank = new MockHttpServletRequest();
        blank.setRemoteAddr("192.0.2.55");
        blank.addHeader(ClientIp.HEADER, "   ");

        MockHttpServletRequest trailingComma = new MockHttpServletRequest();
        trailingComma.setRemoteAddr("192.0.2.55");
        trailingComma.addHeader(ClientIp.HEADER, "203.0.113.7, ");

        assertThat(ClientIp.of(blank)).isEqualTo("192.0.2.55");
        assertThat(ClientIp.of(trailingComma)).isEqualTo("192.0.2.55");
    }

    @Test
    @DisplayName("an oversized forwarded entry is refused in favour of the connection address")
    void oversizedEntryFallsBack() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("192.0.2.55");
        request.addHeader(ClientIp.HEADER, "x".repeat(46));

        assertThat(ClientIp.of(request)).isEqualTo("192.0.2.55");
    }

    @Test
    @DisplayName("an IPv6 client address survives intact")
    void ipv6AddressKept() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(ClientIp.HEADER, "2001:db8:85a3:8d3:1319:8a2e:370:7348");

        assertThat(ClientIp.of(request)).isEqualTo("2001:db8:85a3:8d3:1319:8a2e:370:7348");
    }
}
