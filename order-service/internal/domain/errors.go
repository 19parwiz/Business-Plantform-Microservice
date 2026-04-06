package domain

import "errors"

var ErrOrderNotFound = errors.New("order not found")
var ErrProductNotFound = errors.New("product not found")
var ErrInvalidOrder = errors.New("invalid order payload")
var ErrInvalidOrderStatus = errors.New("invalid order status")
var ErrInvalidOrderStatusTransition = errors.New("invalid order status transition")
