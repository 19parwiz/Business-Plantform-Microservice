package domain

import "testing"

func TestIsValidOrderStatus(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		status OrderStatus
		want   bool
	}{
		{name: "pending is valid", status: StatusPending, want: true},
		{name: "paid is valid", status: StatusPaid, want: true},
		{name: "random status is invalid", status: OrderStatus("random"), want: false},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := IsValidOrderStatus(tc.status); got != tc.want {
				t.Fatalf("IsValidOrderStatus(%q) = %v, want %v", tc.status, got, tc.want)
			}
		})
	}
}

func TestCanTransitionOrderStatus(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		from OrderStatus
		to   OrderStatus
		want bool
	}{
		{name: "pending to paid", from: StatusPending, to: StatusPaid, want: true},
		{name: "pending to delivered is blocked", from: StatusPending, to: StatusDelivered, want: false},
		{name: "delivered to cancelled is blocked", from: StatusDelivered, to: StatusCancelled, want: false},
		{name: "paid to shipped", from: StatusPaid, to: StatusShipped, want: true},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := CanTransitionOrderStatus(tc.from, tc.to); got != tc.want {
				t.Fatalf("CanTransitionOrderStatus(%q, %q) = %v, want %v", tc.from, tc.to, got, tc.want)
			}
		})
	}
}
